// FFmpeg Web Worker for Video Processing
// Offloads FFmpeg-based video processing to a background thread

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Initialize FFmpeg core and wasm files
 */
async function loadFFmpeg() {
  if (ffmpeg) return;
  if (isLoading) return loadPromise;

  isLoading = true;
  loadPromise = (async () => {
    try {
      ffmpeg = new FFmpeg({ log: true });

      // Load the core and wasm files
      await ffmpeg.load({
        coreURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.0/dist/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.0/dist/ffmpeg-core.wasm', 'application/wasm'),
      });

      console.log('[FFmpeg Worker] FFmpeg loaded successfully');
    } catch (error) {
      console.error('[FFmpeg Worker] Failed to load FFmpeg:', error);
      ffmpeg = null;
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Generate a video thumbnail using FFmpeg at a specified time
 */
async function generateThumbnailWithFFmpeg(
  file: File,
  seekTime: number = 1.0
): Promise<string> {
  if (!ffmpeg) {
    await loadFFmpeg();
  }
  if (!ffmpeg) {
    throw new Error('FFmpeg not available');
  }

  // Write the input file to FFmpeg's virtual file system
  const inputName = 'input.mp4';
  const outputName = 'thumbnail.png';

  await ffmpeg.writeFile(inputName, await file.arrayBuffer());

  // FFmpeg command to extract a frame at seekTime and output as a PNG image
  await ffmpeg.exec([
    '-ss', seekTime.toString(),
    '-i', inputName,
    '-frames:v', '1',
    '-vf', 'scale=320:-1', // Example scaling, adjust as needed
    '-update', '1', // Ensure only one frame is written
    outputName
  ]);

  // Read the output file
  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: 'image/png' });

  // Convert to base64 to match existing format
  return await arrayBufferToBase64(data.buffer);
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

self.onmessage = async (e: MessageEvent) => {
  const { id, operation, file, seekTime } = e.data;

  try {
    let result: any = null;

    switch (operation) {
      case 'generateThumbnail':
        const base64 = await generateThumbnailWithFFmpeg(file, seekTime);
        result = { base64, success: true };
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    self.postMessage({ id, ...result });
  } catch (error: any) {
    console.error('[FFmpeg Worker] Error processing message:', error);
    self.postMessage({ id, success: false, error: error.message });
  }
};