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
import { Server, EVENTS } from '@tus/server';
import { FileStore } from '@tus/file-store';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Upload-Length', 'Upload-Metadata', 'Upload-Offset', 'Tus-Resumable', 'Upload-Name', 'Upload-Concat', 'X-Requested-With', 'Range'],
  exposedHeaders: ['Upload-Offset', 'Location', 'Upload-Length', 'Tus-Version', 'Tus-Resumable', 'Tus-Max-Size', 'Tus-Extension', 'Upload-Metadata', 'Upload-Concat', 'Content-Disposition']
}));
app.use(express.json({ limit: '50mb' }));

// Ensure directories exist
await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(path.join(TEMP_DIR, 'tus'), { recursive: true }).catch(() => {});

// --- AUTOMATED HEALTH MONITORING ---
async function sendEmailAlert(subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ALERT_EMAIL_ADDRESS || 'etlabcode@gmail.com';
  if (!apiKey || !toEmail) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'CoGallery Alerts <onboarding@resend.dev>',
        to: [toEmail],
        subject: `[CoGallery] ${subject}`,
        html: `<p>${text.replace(/\n/g, '<br>')}</p>`
      })
    });
    if (!res.ok) {
      console.error('Failed to send email alert:', await res.text());
    }
  } catch (err) {
    console.error('Email alert error:', err);
  }
}

let lastAlertTime = 0;
setInterval(async () => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = (usedMem / totalMem) * 100;

    let diskPercent = 0;
    try {
      const stats = await fs.statfs(__dirname);
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      diskPercent = (used / total) * 100;
    } catch (e) {}

    if (diskPercent > 85 || ramPercent > 95) {
      const now = Date.now();
      if (now - lastAlertTime > 1000 * 60 * 60) { // Max 1 alert per hour
        await sendEmailAlert(
          `CRITICAL: Node Resource Alert on ${os.hostname()}`,
          `Node ${os.hostname()} is running dangerously low on resources.\n\nDisk Usage: ${diskPercent.toFixed(1)}%\nRAM Usage: ${ramPercent.toFixed(1)}%\n\nPlease connect to the Developer Dashboard to clean up storage or scale up nodes.`
        );
        lastAlertTime = now;
      }
    }
  } catch (err) {
    console.error('Health monitor error', err);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Send startup alert
sendEmailAlert(`Node Online: ${os.hostname()}`, `A new CoGallery storage node has successfully booted up and is running PM2.`);

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

// --- CLUSTER HEARTBEAT ---
// Register this specific node in Supabase so the Developer Dashboard can discover it
const startHeartbeat = () => {
  const nodeUrl = process.env.NODE_URL;
  if (!nodeUrl) {
    console.warn('[Cluster] NODE_URL not set. This node will not be discoverable by the Developer Dashboard.');
    return;
  }
  
  const ping = async () => {
    try {
      await supabaseAdmin.from('storage_nodes').upsert(
        { node_url: nodeUrl, last_heartbeat: new Date().toISOString() },
        { onConflict: 'node_url' }
      );
    } catch (e) {
      console.error('[Cluster] Heartbeat failed:', e.message);
    }
  };
  
  ping(); // Initial ping
  setInterval(ping, 60000); // Ping every 60 seconds
};
startHeartbeat();


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

// --- CLUSTER / OTA MANAGEMENT ENDPOINTS ---

app.post('/developer/server/update', authenticateJWT, async (req, res) => {
  try {
    // 1. Acknowledge the request immediately so the frontend knows it succeeded before the process dies
    res.json({ success: true, message: 'Syncing code and restarting...' });
    
    // 2. Run the update in the background after a short delay to let the response flush
    setTimeout(async () => {
      console.log('[OTA] Running git pull and npm install...');
      try {
        await execPromise('git pull origin main && npm install');
        console.log('[OTA] Update successful. Restarting PM2...');
        await execPromise('pm2 restart all');
      } catch (e) {
        console.error('[OTA] Update failed:', e);
      }
    }, 2000);
  } catch (err) {
    res.status(500).json({ error: err.message });
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


app.post('/developer/storage/nuke-files', authenticateJWT, async (req, res) => {
  try {
    const { filenames } = req.body;
    if (!filenames || !Array.isArray(filenames)) {
      return res.status(400).json({ error: 'Missing filenames array' });
    }

    let deletedCount = 0;
    for (const filename of filenames) {
      try {
        const dataPath = path.join(CACHE_DIR, `${filename}.data`);
        const metaPath = path.join(CACHE_DIR, `${filename}.meta.json`);
        await fs.unlink(dataPath).catch(() => {});
        await fs.unlink(metaPath).catch(() => {});
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete local file ${filename}:`, e);
      }
    }

    res.json({ success: true, deletedFiles: deletedCount });
  } catch (error) {
    console.error("Nuke files failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- EPHEMERAL SECURE GET URL (ZERO TRUST) ---
app.post('/media/presign-get', authenticateJWT, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });
    
    // Generate a short-lived JWT token that grants read access to this specific file
    const streamToken = jwt.sign({ key }, JWT_SECRET, { expiresIn: '12h' });
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

const tusServer = new Server({
  path: '/upload/tus',
  datastore: new FileStore({ directory: path.join(TEMP_DIR, 'tus') }),
  respectForwardedHeaders: true,
});

tusServer.on(EVENTS.POST_FINISH, async (req, res, upload) => {
  try {
    const photoId = upload.metadata?.photoId;
    const filename = upload.metadata?.filename || 'file';
    const mimeType = upload.metadata?.filetype || 'application/octet-stream';
    
    if (photoId) {
      const finalPath = path.join(CACHE_DIR, `${photoId}.data`);
      const metaPath = path.join(CACHE_DIR, `${photoId}.meta.json`);
      const tusFilePath = path.join(TEMP_DIR, 'tus', upload.id);
      
      // Move file to final location
      await fs.rename(tusFilePath, finalPath);
      // Write meta.json
      await fs.writeFile(metaPath, JSON.stringify({ filename, mimeType, size: upload.size }));
      
      // Clean up the .info file
      await fs.unlink(`${tusFilePath}.info`).catch(() => {});
      
      const nodeUrl = process.env.NODE_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      const finalUrl = `${nodeUrl}/stream/${photoId}`;
      if (supabaseAdmin) {
        await supabaseAdmin.from('photos').update({ s3_url: finalUrl }).eq('id', photoId);
        console.log(`[Upload] TUS upload completed and Sharded Storage Node URL stamped: ${finalUrl}`);
      } else {
        console.log(`[Upload] TUS upload completed for photoId: ${photoId} (No Supabase Admin - URL not stamped)`);
      }
    }
  } catch (error) {
    console.error(`[Upload] Error in TUS finish handler:`, error);
  }
});

// Intercept TUS routes
app.use('/upload/tus', authenticateJWT, (req, res) => {
  tusServer.handle(req, res);
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

// --- CLIENT ERROR TELEMETRY ---
app.post('/telemetry/error', express.json({ limit: '100kb' }), (req, res) => {
  console.error('[Client Error]', JSON.stringify(req.body));
  res.json({ ok: true });
});

// --- GITHUB ARCHIVE ---
async function userCanArchiveEvent(userId, eventId) {
  if (!supabaseAdmin) return false;
  const { data: event } = await supabaseAdmin.from('events').select('creator_id').eq('id', eventId).single();
  if (!event) return false;
  if (event.creator_id === userId) return true;
  const { data: member } = await supabaseAdmin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle();
  return member?.role === 'owner';
}

app.post('/events/:eventId/archive-to-github', authenticateJWT, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?.sub;
  const { isPublic = true } = req.body || {};

  const githubToken = process.env.GITHUB_TOKEN;
  const githubUsername = process.env.GITHUB_USERNAME;

  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Archive service not configured (missing SUPABASE_SERVICE_ROLE_KEY)' });
  }
  if (!githubToken || !githubUsername) {
    return res.status(503).json({ error: 'GitHub archive not configured (GITHUB_TOKEN, GITHUB_USERNAME)' });
  }

  const allowed = await userCanArchiveEvent(userId, eventId);
  if (!allowed) {
    return res.status(403).json({ error: 'Only event owners can archive' });
  }

  try {
    await supabaseAdmin.from('events').update({ archive_status: 'processing' }).eq('id', eventId);

    const { data: event, error: eventErr } = await supabaseAdmin.from('events').select('*').eq('id', eventId).single();
    if (eventErr || !event) throw new Error('Event not found');

    const { data: photos, error: photosErr } = await supabaseAdmin
      .from('photos')
      .select('id, filename, s3_url, thumbnail_url, thumbnail_base64, taken_at, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (photosErr) throw photosErr;

    const result = await archiveEventToGitHub({
      event,
      photos: photos || [],
      githubToken,
      githubUsername,
      isPublic,
    });

    await supabaseAdmin.from('events').update({
      archive_status: 'completed',
      github_repo_url: result.repoUrl,
      github_pages_url: result.pagesUrl,
      archived_at: new Date().toISOString(),
    }).eq('id', eventId);

    res.json({
      status: 'completed',
      repoUrl: result.repoUrl,
      pagesUrl: result.pagesUrl,
      photoCount: result.photoCount,
      message: 'Archive published to GitHub Pages',
    });
  } catch (err) {
    console.error('[Archive]', err);
    await supabaseAdmin.from('events').update({ archive_status: 'failed' }).eq('id', eventId);
    res.status(500).json({ error: err.message || 'Archive failed' });
  }
});

app.get('/events/:eventId/archive-status', authenticateJWT, async (req, res) => {
  const { eventId } = req.params;
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Archive service not configured' });
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('archive_status, github_repo_url, github_pages_url, archived_at')
    .eq('id', eventId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const { count } = await supabaseAdmin
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  res.json({
    status: data.archive_status || 'none',
    repoUrl: data.github_repo_url,
    pagesUrl: data.github_pages_url,
    archivedAt: data.archived_at,
    photoCount: count ?? 0,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`🚀 CoGallery Oracle Backend running on port ${PORT}`);
  console.log(`===========================================`);
});
