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
import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// Some commonJS modules in ESM require this workaround if default export is missing:
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

// R2 Configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cogallery-photos';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'file-cache');
const TEMP_DIR = path.join(__dirname, 'temp-chunks');

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

// --- ZERO-TRUST SECURITY MIDDLEWARE ---
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token' });
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

// --- GOD MODE TELEMETRY ---
app.get('/developer/telemetry', authenticateJWT, async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg();
    
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
      uptime: os.uptime(),
      logs: pm2Logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Pre-signed URL for direct R2 upload
app.get('/upload/presigned-url', authenticateJWT, uploadLimiter, async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Missing filename or contentType' });
    }
    
    // We can use the filename as the key, or prepend a UUID. The client passes a unique filename.
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
    });
    
    // URL expires in 1 hour
    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    
    return res.json({ url: presignedUrl, key: filename });
  } catch (error) {
    console.error('Presigned URL error:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// --- EPHEMERAL PRESIGNED GET URL ---
app.post('/media/presign-get', authenticateJWT, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    // URL Self-Destructs in 60 seconds
    const url = await getSignedUrl(r2Client, command, { expiresIn: 60 });
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- MULTIPART UPLOAD ENDPOINTS ---
app.post('/upload/multipart/create', authenticateJWT, uploadLimiter, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      ContentType: contentType
    });
    const { UploadId } = await r2Client.send(command);
    res.json({ uploadId: UploadId, key: filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload/multipart/sign-part', authenticateJWT, uploadLimiter, async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.body;
    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber
    });
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload/multipart/complete', authenticateJWT, uploadLimiter, async (req, res) => {
  try {
    const { key, uploadId, parts } = req.body;
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });
    await r2Client.send(command);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload/multipart/abort', authenticateJWT, uploadLimiter, async (req, res) => {
  try {
    const { key, uploadId } = req.body;
    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId
    });
    await r2Client.send(command);
    res.json({ success: true });
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
app.post('/upload/chunk', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
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
