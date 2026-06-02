import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Ensure directories exist
await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});

// Health Check
app.get('/status', (req, res) => {
  res.json({ status: 'online', service: 'CoGallery Oracle Backend' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`🚀 CoGallery Oracle Backend running on port ${PORT}`);
  console.log(`===========================================`);
});
