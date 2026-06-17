import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { pipeline } from 'stream/promises';
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
import sharp from 'sharp';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
const streamJwtSecret = process.env.STREAM_JWT_SECRET || supabaseJwtSecret;
const streamTokenTtl = process.env.STREAM_TOKEN_TTL || '15m';

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL');
}

if (!streamJwtSecret || streamJwtSecret.length < 32) {
  throw new Error('Missing STREAM_JWT_SECRET or SUPABASE_JWT_SECRET with at least 32 characters');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'uploads');
const TEMP_DIR = path.join(__dirname, 'uploads/temp');

const supabaseJwks = jwksClient({
  jwksUri: `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function isSafeStorageKey(key) {
  return typeof key === 'string'
    && key.length > 0
    && key.length <= 256
    && !key.includes('/')
    && !key.includes('\\')
    && !key.includes('..')
    && /^[A-Za-z0-9._~:-]+$/.test(key);
}

function storagePaths(key) {
  if (!isSafeStorageKey(key)) {
    const error = new Error('Invalid storage key');
    error.statusCode = 400;
    throw error;
  }

  return {
    dataPath: path.join(CACHE_DIR, `${key}.data`),
    metaPath: path.join(CACHE_DIR, `${key}.meta.json`),
    previewPath: path.join(CACHE_DIR, `${key}.preview.webp`),
    chunkDir: path.join(TEMP_DIR, key),
  };
}

function safeAttachmentFilename(filename) {
  return String(filename || 'download')
    .replace(/[\r\n"]/g, '')
    .replace(/[\\/]/g, '_')
    .slice(0, 180);
}

function verifySupabaseJwt(token) {
  return new Promise((resolve, reject) => {
    const decoded = jwt.decode(token, { complete: true });
    const algorithm = decoded?.header?.alg;

    if (algorithm === 'HS256') {
      if (!supabaseJwtSecret) {
        reject(new Error('Server is missing SUPABASE_JWT_SECRET for HS256 tokens'));
        return;
      }
      jwt.verify(token, supabaseJwtSecret, { algorithms: ['HS256'] }, (err, payload) => {
        if (err) reject(err);
        else resolve(payload);
      });
      return;
    }

    if (algorithm === 'RS256' || algorithm === 'ES256') {
      supabaseJwks.getSigningKey(decoded.header.kid, (keyErr, key) => {
        if (keyErr) {
          reject(keyErr);
          return;
        }

        const signingKey = key.getPublicKey();
        jwt.verify(token, signingKey, { algorithms: ['RS256', 'ES256'] }, (err, payload) => {
          if (err) reject(err);
          else resolve(payload);
        });
      });
      return;
    }

    reject(new Error(`Unsupported JWT algorithm: ${algorithm || 'unknown'}`));
  });
}

const app = express();
app.set('trust proxy', 1);

// Allow all origins (since frontend is on Cloudflare Pages)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Upload-Length', 'Upload-Metadata', 'Upload-Offset', 'Tus-Resumable', 'Upload-Name', 'Upload-Concat', 'X-Requested-With', 'Range'],
  exposedHeaders: ['Upload-Offset', 'Location', 'Upload-Length', 'Tus-Version', 'Tus-Resumable', 'Tus-Max-Size', 'Tus-Extension', 'Upload-Metadata', 'Upload-Concat', 'Content-Disposition']
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
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
  if (!supabaseAdmin) {
    console.warn('[Cluster] SUPABASE_SERVICE_ROLE_KEY not set. Heartbeat disabled.');
    return;
  }
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
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  try {
    const user = await verifySupabaseJwt(token);
    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Max 500 requests per IP
  message: { error: 'Too many requests, auto-banned for 15 minutes' }
});

const mediaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  message: { error: 'Too many media requests. Please slow down.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Too many admin requests. Please slow down.' },
});

function requireSupabaseAdmin(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server admin client is not configured' });
  }
  next();
}

async function isAdminUser(userId) {
  if (!supabaseAdmin || !userId) return false;

  try {
    const { data, error } = await supabaseAdmin.rpc('is_admin', { user_uid: userId });
    if (!error && data === true) return true;
  } catch {}

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();
    return !error && data?.is_admin === true;
  } catch {
    return false;
  }
}

async function requireAdmin(req, res, next) {
  const userId = req.user?.sub;
  if (!(await isAdminUser(userId))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function findPhotoByStorageKey(key) {
  if (!supabaseAdmin || !isSafeStorageKey(key)) return null;

  const columns = 'id,event_id,room_id,uploader_id,filename,s3_key,s3_url';
  const byS3Key = await supabaseAdmin
    .from('photos')
    .select(columns)
    .eq('s3_key', key)
    .maybeSingle();

  if (byS3Key.data) return byS3Key.data;

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  if (uuidLike) {
    const byId = await supabaseAdmin
      .from('photos')
      .select(columns)
      .eq('id', key)
      .maybeSingle();
    if (byId.data) return byId.data;
  }

  return null;
}

async function userCanAccessPhoto(userId, photo) {
  if (!supabaseAdmin || !userId || !photo) return false;
  if (photo.uploader_id === userId) return true;

  const [roomMember, eventMember] = await Promise.all([
    supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', photo.room_id)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('event_members')
      .select('id')
      .eq('event_id', photo.event_id)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle(),
  ]);

  return Boolean(roomMember.data || eventMember.data);
}

async function requirePhotoAccess(userId, key) {
  const photo = await findPhotoByStorageKey(key);
  if (!photo) {
    const error = new Error('Media not found');
    error.statusCode = 404;
    throw error;
  }

  if (!(await userCanAccessPhoto(userId, photo))) {
    const error = new Error('You do not have access to this media');
    error.statusCode = 403;
    throw error;
  }

  return photo;
}

function verifyStreamToken(token, key) {
  const decoded = jwt.verify(token, streamJwtSecret);
  if (decoded.scope !== 'media:read' || decoded.key !== key) {
    const error = new Error('Token does not match media');
    error.statusCode = 403;
    throw error;
  }
  return decoded;
}


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
app.get('/developer/telemetry', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, async (req, res) => {
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

app.post('/developer/server/update', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, async (req, res) => {
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
app.post('/developer/storage/clear-temp', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, async (req, res) => {
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

app.post('/developer/storage/clear-old', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, async (req, res) => {
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

app.post('/developer/storage/wipe-all', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, async (req, res) => {
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

app.get('/developer/storage/backup', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, (req, res) => {
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
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Stream Media Preview (WebP 800px)
app.get('/preview/:photoId', async (req, res) => {
  const { photoId } = req.params;
  const token = req.query.t;
  
  if (!token) {
    return res.status(401).json({ error: 'Missing access token (Zero Trust)' });
  }
  
  try {
    verifyStreamToken(token, photoId);
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  let paths;
  try {
    paths = storagePaths(photoId);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
  
  try {
    // Try to serve preview first
    await fs.access(paths.previewPath);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    const stream = fsSync.createReadStream(paths.previewPath);
    stream.pipe(res);
  } catch {
    // Fallback to original
    try {
      await fs.access(paths.dataPath);
      const metaRaw = await fs.readFile(paths.metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw);
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      const stream = fsSync.createReadStream(paths.dataPath);
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(404).json({ error: 'Preview/File not found' });
    }
  }
});


app.post('/developer/storage/nuke-files', adminLimiter, authenticateJWT, requireSupabaseAdmin, requireAdmin, async (req, res) => {
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
app.post('/media/presign-get', mediaLimiter, authenticateJWT, requireSupabaseAdmin, async (req, res) => {
  try {
    const { key, type } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });
    if (!isSafeStorageKey(key)) return res.status(400).json({ error: 'Invalid key' });

    const photo = await requirePhotoAccess(req.user?.sub, key);
    
    // Generate a short-lived JWT token that grants read access to this specific file
    const streamToken = jwt.sign(
      { key, photoId: photo.id, sub: req.user?.sub, scope: 'media:read' },
      streamJwtSecret,
      { expiresIn: streamTokenTtl },
    );
    const url = type === 'preview' ? `/preview/${encodeURIComponent(key)}?t=${streamToken}` : `/stream/${encodeURIComponent(key)}?t=${streamToken}`;
    
    res.json({ url });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.post('/upload/chunk', uploadLimiter, authenticateJWT, async (req, res) => {
  try {
    const key = req.header('x-photo-id');
    const chunkIndex = Number.parseInt(req.header('x-chunk-index') || '', 10);
    const totalChunks = Number.parseInt(req.header('x-total-chunks') || '', 10);
    const filename = safeAttachmentFilename(decodeURIComponent(req.header('x-filename') || key || 'upload'));
    const mimeType = req.header('x-mime-type') || 'application/octet-stream';
    const isEncrypted = req.header('x-is-encrypted') === 'true';

    if (!isSafeStorageKey(key)) {
      return res.status(400).json({ error: 'Invalid upload key' });
    }
    if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
      return res.status(400).json({ error: 'Invalid chunk headers' });
    }

    const paths = storagePaths(key);
    await fs.mkdir(paths.chunkDir, { recursive: true });

    const partPath = path.join(paths.chunkDir, `${chunkIndex}.part`);
    await pipeline(req, fsSync.createWriteStream(partPath, { flags: 'w' }));

    const partFiles = await fs.readdir(paths.chunkDir);
    const completedParts = partFiles.filter((file) => file.endsWith('.part')).length;

    if (completedParts === totalChunks) {
      const writeStream = fsSync.createWriteStream(paths.dataPath, { flags: 'w' });
      const finishedWriting = new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      try {
        for (let index = 0; index < totalChunks; index++) {
          const currentPart = path.join(paths.chunkDir, `${index}.part`);
          await fs.access(currentPart);
          await pipeline(fsSync.createReadStream(currentPart), writeStream, { end: false });
        }
      } finally {
        writeStream.end();
      }

      await finishedWriting;

      const stat = await fs.stat(paths.dataPath);
      await fs.writeFile(paths.metaPath, JSON.stringify({ filename, mimeType, size: stat.size }));
      await fs.rm(paths.chunkDir, { recursive: true, force: true }).catch(() => {});

      if (mimeType.startsWith('image/') && !isEncrypted) {
        try {
          await sharp(paths.dataPath)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(paths.previewPath);
        } catch (err) {
          console.error(`[Upload] Failed to generate preview for ${key}:`, err);
        }
      }
    }

    res.json({ ok: true, completed: completedParts === totalChunks });
  } catch (error) {
    console.error('[Upload] Chunk upload failed:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Check upload progress (for resuming)
app.get('/upload/status/:photoId', mediaLimiter, authenticateJWT, async (req, res) => {
  const { photoId } = req.params;
  let paths;
  try {
    paths = storagePaths(photoId);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
  
  // Check if completely finished
  try {
    await fs.access(paths.dataPath);
    return res.json({ completed: true });
  } catch {}

  // Check partial chunks
  try {
    const files = await fs.readdir(paths.chunkDir);
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
    const isEncrypted = upload.metadata?.isEncrypted === 'true' || upload.metadata?.isEncrypted === true;
    
    if (photoId) {
      const paths = storagePaths(photoId);
      const finalPath = paths.dataPath;
      const metaPath = paths.metaPath;
      const tusFilePath = path.join(TEMP_DIR, 'tus', upload.id);
      
      // Move file to final location
      await fs.rename(tusFilePath, finalPath);
      // Write meta.json
      await fs.writeFile(metaPath, JSON.stringify({ filename, mimeType, size: upload.size }));
      
      // Clean up the .info file
      await fs.unlink(`${tusFilePath}.info`).catch(() => {});
      
      // Generate WebP preview for images (skip if encrypted)
      if (mimeType.startsWith('image/') && !isEncrypted) {
        try {
          const previewPath = path.join(CACHE_DIR, `${photoId}.preview.webp`);
          await sharp(finalPath)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(previewPath);
          console.log(`[Upload] Generated preview for ${photoId}`);
        } catch (err) {
          console.error(`[Upload] Failed to generate preview for ${photoId}:`, err);
        }
      }
      
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
app.use('/upload/tus', uploadLimiter, authenticateJWT, (req, res) => {
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
    verifyStreamToken(token, photoId);
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  let paths;
  try {
    paths = storagePaths(photoId);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
  
  try {
    const meta = JSON.parse(await fs.readFile(paths.metaPath, 'utf-8'));
    const stat = await fs.stat(paths.dataPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // HTTP 206 Range Request (for seekable video streaming)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end >= fileSize || start > end) {
        return res.status(416).json({ error: 'Invalid range' });
      }
      
      const file = fsSync.createReadStream(paths.dataPath, { start, end });
      
      const download = req.query.download === '1';
      const filename = safeAttachmentFilename(req.query.filename || meta.filename || photoId);
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': meta.mimeType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      };
      if (download) {
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
      }
      
      res.writeHead(206, headers);
      
      file.pipe(res);
    } else {
      // Full download/stream
      const download = req.query.download === '1';
      const filename = safeAttachmentFilename(req.query.filename || meta.filename || photoId);
      const headers = {
        'Content-Length': fileSize,
        'Content-Type': meta.mimeType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      };
      if (download) {
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
      }
      res.writeHead(200, headers);
      fsSync.createReadStream(paths.dataPath).pipe(res);
    }
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Fallback ZIP streaming endpoint for iOS/Safari
app.post('/api/download-zip', mediaLimiter, authenticateJWT, requireSupabaseAdmin, [express.json({ limit: '10mb' }), express.urlencoded({ extended: true, limit: '10mb' })], async (req, res) => {
  // If sent via form urlencoded, req.body.photos is a stringified JSON array
  let photos = req.body.photos;
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch (e) {}
  }
  const filename = req.body.filename;

  if (!photos || !Array.isArray(photos)) {
    return res.status(400).json({ error: 'Missing photos array' });
  }
  if (photos.length > 1000) {
    return res.status(400).json({ error: 'ZIP downloads are limited to 1000 files at a time' });
  }

  const requestedPhotos = [];
  for (const photo of photos) {
    const key = photo.id || photo.key || photo.s3Key;
    if (!isSafeStorageKey(key)) {
      return res.status(400).json({ error: 'Invalid photo key in ZIP request' });
    }

    try {
      const authorizedPhoto = await requirePhotoAccess(req.user?.sub, key);
      requestedPhotos.push({
        key,
        filename: safeAttachmentFilename(photo.filename || authorizedPhoto.filename || key),
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${safeAttachmentFilename(filename || 'gallery')}.zip"`,
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

  // Append each file directly from local storage to bypass network loop
  for (const photo of requestedPhotos) {
    if (!photo.key || !photo.filename) continue;
    try {
      const { dataPath } = storagePaths(photo.key);
      
      // Check if file exists locally
      try {
        await fs.access(dataPath);
        archive.file(dataPath, { name: photo.filename });
      } catch (err) {
        console.error(`File missing for zip: ${photo.key}`);
        archive.append(`File not found: ${photo.key}`, { name: `${photo.filename}.error.txt` });
      }
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
