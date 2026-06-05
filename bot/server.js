import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import https from 'https';
import dotenv from 'dotenv';
import jwksClient from 'jwks-rsa';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'uploads');
const TEMP_DIR = path.join(__dirname, 'uploads/temp');

const supabasePublicKey = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES1i7lih7PQfCnIBs0bYc6YL/X0fm
mtrchCOYjNWS0QMtuHTVB0zbjWw8OjXmtI1367dWAPbRK8oKJuVUj2avWw==
-----END PUBLIC KEY-----`;

function getSupabaseKey(header, callback) {
  // Always return the static public key for ES256 tokens
  callback(null, supabasePublicKey);
}

const app = express();

// Allow all origins (since frontend is on Cloudflare Pages)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['*']
}));
app.use(express.json({ limit: '50mb' }));

// Ensure directories exist
await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});

// --- DISK JANITOR ---
// Clean up temp chunks older than 24 hours every day
setInterval(async () => {
  try {
    const now = Date.now();
    const dirs = await fs.readdir(TEMP_DIR);
    for (const dir of dirs) {
      const dirPath = path.join(TEMP_DIR, dir);
      const stat = await fs.stat(dirPath);
      if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {});
        console.log(`[Janitor] Cleaned abandoned upload: ${dir}`);
      }
    }
  } catch (err) {
    console.error('[Janitor] Cleanup error:', err);
  }
}, 24 * 60 * 60 * 1000);

// --- ZERO-TRUST SECURITY MIDDLEWARE ---
// Keep JWT_SECRET for internal short-lived streaming tokens
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    // Verify using Supabase JWKS (supports both ES256 and RS256)
    jwt.verify(token, getSupabaseKey, { algorithms: ['RS256', 'ES256'] }, (err, user) => {
      if (err) {
        console.error("JWT Verification failed:", err.message);
        return res.status(403).json({ error: 'Invalid or expired token', details: err.message });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header missing' });
  }
};

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Max 500 requests per IP
  message: { error: 'Too many requests, auto-banned for 15 minutes' }
});


// Health Check
app.get('/status', (req, res) => {
  res.json({ status: 'online', service: 'CoGallery Oracle Backend' });
});

// --- DEVELOPER STORAGE UTILS ---
async function getFolderSize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (file.name.startsWith('.')) continue; // skip hidden files
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        const sub = await getFolderSize(fullPath);
        totalSize += sub.size;
        fileCount += sub.count;
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
        fileCount += 1;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Error calculating folder size for ${dirPath}:`, err);
  }
  return { size: totalSize, count: fileCount };
}

// --- GOD MODE TELEMETRY ---
app.get('/developer/telemetry', authenticateJWT, async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg();
    
    // Get disk usage (using statfs)
    let diskUsage = { total: 0, free: 0, used: 0, percent: 0 };
    try {
      const stats = await fs.statfs(__dirname);
      diskUsage.total = stats.blocks * stats.bsize;
      diskUsage.free = stats.bfree * stats.bsize;
      diskUsage.used = diskUsage.total - diskUsage.free;
      diskUsage.percent = Math.round((diskUsage.used / diskUsage.total) * 100);
    } catch (e) {
      console.warn("Failed to fetch disk usage", e);
    }

    // Get folder sizes
    const mainStorage = await getFolderSize(CACHE_DIR);
    const tempStorage = await getFolderSize(TEMP_DIR);
    // Subtract temp size from main size since TEMP_DIR is inside CACHE_DIR
    mainStorage.size -= tempStorage.size;
    mainStorage.count -= tempStorage.count;
    
    let pm2Logs = "PM2 not found or not running.";
    try {
      const { stdout } = await execPromise('pm2 logs cogallery-seedbox --lines 50 --nostream');
      pm2Logs = stdout;
    } catch (e) {
      console.warn("Failed to fetch PM2 logs", e);
    }

    res.json({
      cpuLoad,
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percent: Math.round((usedMem / totalMem) * 100)
      },
      disk: diskUsage,
      storage: {
        main: mainStorage,
        temp: tempStorage
      },
      uptime: os.uptime(),
      logs: pm2Logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- STORAGE MANAGEMENT ENDPOINTS ---

app.post('/developer/storage/clear-temp', authenticateJWT, async (req, res) => {
  try {
    const dirs = await fs.readdir(TEMP_DIR);
    let deletedCount = 0;
    for (const dir of dirs) {
      if (dir.startsWith('.')) continue;
      const dirPath = path.join(TEMP_DIR, dir);
      await fs.rm(dirPath, { recursive: true, force: true });
      deletedCount++;
    }
    res.json({ success: true, deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/developer/storage/clear-old', authenticateJWT, async (req, res) => {
  try {
    const files = await fs.readdir(CACHE_DIR, { withFileTypes: true });
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    for (const file of files) {
      if (file.isDirectory() || file.name.startsWith('.')) continue;
      const filePath = path.join(CACHE_DIR, file.name);
      const stat = await fs.stat(filePath);
      
      if (now - stat.mtimeMs > THIRTY_DAYS_MS) {
        await fs.unlink(filePath).catch(() => {});
        deletedCount++;
      }
    }
    res.json({ success: true, deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/developer/storage/wipe-all', authenticateJWT, async (req, res) => {
  try {
    // Re-create the directories after wiping
    await fs.rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
    await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/developer/storage/backup', authenticateJWT, (req, res) => {
  try {
    res.attachment('cogallery-backup.zip');
    const archive = archiver('zip', {
      zlib: { level: 5 } // Balance between speed and compression
    });

    archive.on('error', function(err) {
      res.status(500).send({error: err.message});
    });

    // on stream closed we can end the request
    archive.on('end', function() {
      console.log('Archive wrote %d bytes', archive.pointer());
    });

    archive.pipe(res);
    // Append files from the uploads directory, excluding the temp directory
    archive.directory(CACHE_DIR, false, file => {
      // Return false to exclude temp directory
      return file.name.startsWith('temp') ? false : file;
    });
    
    archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});


app.post('/developer/nuke-user', authenticateJWT, async (req, res) => {
  try {
    const { target_uid, supabaseUrl, supabaseAnonKey } = req.body;
    const token = req.headers.authorization.split(' ')[1];

    if (!target_uid || !supabaseUrl || !supabaseAnonKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // 1. Init Supabase client with the Admin's JWT token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // 2. Fetch all photos for this user (Since we use the admin token, God View RLS allows us to see all photos)
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('filename')
      .eq('uploader_id', target_uid);

    if (fetchError) throw fetchError;

    // 3. Batch delete from Local Storage
    if (photos && photos.length > 0) {
      for (const p of photos) {
        try {
          const dataPath = path.join(CACHE_DIR, `${p.filename}.data`);
          const metaPath = path.join(CACHE_DIR, `${p.filename}.meta.json`);
          await fs.unlink(dataPath).catch(() => {});
          await fs.unlink(metaPath).catch(() => {});
        } catch (e) {
          console.error(`Failed to delete local file ${p.filename}:`, e);
        }
      }
    }

    // 4. Finally, call the RPC to permanently delete the user from the database
    const { error: rpcError } = await supabase.rpc('admin_delete_user', { target_uid });
    if (rpcError) throw rpcError;

    res.json({ success: true, deletedFiles: photos ? photos.length : 0 });
  } catch (error) {
    console.error("Nuke user failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- EPHEMERAL SECURE GET URL (ZERO TRUST) ---
app.post('/media/presign-get', authenticateJWT, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });
    
    // Generate a short-lived JWT token that grants read access to this specific file
    const streamToken = jwt.sign({ key }, JWT_SECRET, { expiresIn: '60s' });
    const url = `/stream/${encodeURIComponent(key)}?t=${streamToken}`;
    
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check upload progress (for resuming)
app.get('/upload/status/:photoId', async (req, res) => {
  const { photoId } = req.params;
  
  // Check if completely finished
  try {
    await fs.access(path.join(CACHE_DIR, `${photoId}.data`));
    return res.json({ completed: true });
  } catch {}

  // Check partial chunks
  try {
    const chunkDir = path.join(TEMP_DIR, photoId);
    const files = await fs.readdir(chunkDir);
    const indices = files.filter(f => f.endsWith('.part')).map(f => parseInt(f.replace('.part', ''), 10));
    res.json({ completed: false, chunks: indices });
  } catch {
    res.json({ completed: false, chunks: [] });
  }
});

// In-memory locks to prevent race conditions when chunks finish concurrently
const assemblyLocks = new Set();

// Upload chunk
app.post('/upload/chunk', authenticateJWT, express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  const photoId = req.headers['x-photo-id'];
  const chunkIndex = parseInt(req.headers['x-chunk-index'], 10);
  const totalChunks = parseInt(req.headers['x-total-chunks'], 10);
  const filename = decodeURIComponent(req.headers['x-filename'] || 'file');
  const mimeType = req.headers['x-mime-type'] || 'application/octet-stream';
  
  if (!photoId || isNaN(chunkIndex) || isNaN(totalChunks)) {
    return res.status(400).json({ error: 'Missing headers' });
  }
  
  const chunkData = req.body;
  if (!chunkData || chunkData.length === 0) {
    return res.status(400).json({ error: 'Empty body' });
  }

  const chunkDir = path.join(TEMP_DIR, photoId);
  await fs.mkdir(chunkDir, { recursive: true }).catch(() => {});
  
  const partPath = path.join(chunkDir, `${chunkIndex}.part`);
  await fs.writeFile(partPath, chunkData);
  
  // Check if we have all chunks
  const files = await fs.readdir(chunkDir);
  const partFiles = files.filter(f => f.endsWith('.part'));
  
  if (partFiles.length === totalChunks) {
    if (assemblyLocks.has(photoId)) {
      return res.json({ success: true, message: 'Chunk received, assembly already in progress' });
    }
    
    assemblyLocks.add(photoId);
    
    try {
      const finalPath = path.join(CACHE_DIR, `${photoId}.data`);
      const metaPath = path.join(CACHE_DIR, `${photoId}.meta.json`);
      
      let totalSize = 0;
      const writeStream = fsSync.createWriteStream(finalPath);
      
      // Must append in correct order!
      for (let i = 0; i < totalChunks; i++) {
        const pPath = path.join(chunkDir, `${i}.part`);
        const data = await fs.readFile(pPath);
        writeStream.write(data);
        totalSize += data.length;
      }
      
      writeStream.end();
      
      await new Promise((resolve) => writeStream.on('finish', resolve));
      await fs.writeFile(metaPath, JSON.stringify({ filename, mimeType, size: totalSize }));
      
      // Cleanup temp chunks
      await fs.rm(chunkDir, { recursive: true, force: true }).catch(() => {});
      assemblyLocks.delete(photoId);
      
      console.log(`[Upload] Merged ${photoId} successfully (${totalSize} bytes)`);
      return res.json({ status: 'completed' });
    } catch (err) {
      console.error(`[Upload] Error merging ${photoId}:`, err);
      return res.status(500).json({ error: 'Merge failed' });
    }
  }
  
  res.json({ status: 'chunk_received', received: partFiles.length, total: totalChunks });
});

// Stream Media (Video/Image) with HTTP 206 Partial Content support
app.get('/stream/:photoId', async (req, res) => {
  const { photoId } = req.params;
  const token = req.query.t;
  
  if (!token) {
    return res.status(401).json({ error: 'Missing access token (Zero Trust)' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.key !== photoId) {
      return res.status(403).json({ error: 'Token does not match file' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  const dataPath = path.join(CACHE_DIR, `${photoId}.data`);
  const metaPath = path.join(CACHE_DIR, `${photoId}.meta.json`);
  
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    const stat = await fs.stat(dataPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // HTTP 206 Range Request (for seekable video streaming)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const file = fsSync.createReadStream(dataPath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': meta.mimeType,
        'Access-Control-Allow-Origin': '*',
      });
      
      file.pipe(res);
    } else {
      // Full download/stream
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': meta.mimeType,
        'Access-Control-Allow-Origin': '*',
      });
      fsSync.createReadStream(dataPath).pipe(res);
    }
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Fallback ZIP streaming endpoint for iOS/Safari
app.post('/api/download-zip', authenticateJWT, [express.json({ limit: '10mb' }), express.urlencoded({ extended: true, limit: '10mb' })], async (req, res) => {
  // If sent via form urlencoded, req.body.photos is a stringified JSON array
  let photos = req.body.photos;
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch (e) {}
  }
  const filename = req.body.filename;

  if (!photos || !Array.isArray(photos)) {
    return res.status(400).json({ error: 'Missing photos array' });
  }

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename || 'gallery'}.zip"`,
    'Access-Control-Expose-Headers': 'Content-Disposition'
  });

  const archive = archiver('zip', {
    zlib: { level: 0 } // No compression for speed (photos/videos are already compressed)
  });

  archive.on('error', (err) => {
    console.error('Archiver error:', err);
    res.status(500).end();
  });

  archive.pipe(res);

  // Append each file from its URL stream sequentially to avoid overwhelming server sockets
  for (const photo of photos) {
    if (!photo.url || !photo.filename) continue;
    try {
      await new Promise((resolve) => {
        const reqStream = photo.url.startsWith('https') ? https : null; // Assuming S3 presigned URLs are HTTPS
        if (!reqStream) return resolve();

        reqStream.get(photo.url, (response) => {
          if (response.statusCode === 200) {
            archive.append(response, { name: photo.filename });
            response.on('end', resolve);
            response.on('error', resolve);
          } else {
            resolve();
          }
        }).on('error', resolve);
      });
    } catch (e) {
      console.error('Error fetching photo for zip:', e);
    }
  }

  archive.finalize();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`🚀 CoGallery Oracle Backend running on port ${PORT}`);
  console.log(`===========================================`);
});
