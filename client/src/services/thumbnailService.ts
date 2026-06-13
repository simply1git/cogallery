/**
 * Thumbnail Service
 * Generates tiny preview thumbnails client-side using Canvas API.
 * Thumbnails are stored as base64 strings directly in the database (~5-15KB each).
 * This means NO cloud storage is needed for previews.
 */

const MAX_THUMB_DIM = 800
const THUMB_QUALITY = 0.8 // high quality
const VIDEO_SEEK_TIME = 1   // capture frame at 1 second

// Fallback manual blob to base64 (used if worker fails or for videos)
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${blob.type};base64,${btoa(binary)}`
}

// Initialize the Web Worker (only once)
let worker: Worker | null = null;
let jobIdCounter = 0;
const workerPromises = new Map<number, { resolve: (val: { base64: string, blurhash?: string }) => void, reject: (err: any) => void }>();

function getWorker() {
  if (typeof window === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, success, base64, blurhash, error } = e.data;
      const promise = workerPromises.get(id);
      if (promise) {
        if (success) promise.resolve({ base64, blurhash });
        else promise.reject(new Error(error));
        workerPromises.delete(id);
      }
    };
  }
  return worker;
}

/**
 * Generate a base64 JPEG thumbnail from an image File.
 * Offloads all processing to a Web Worker so the UI never freezes!
 */
export function generateImageThumbnail(file: File): Promise<{ base64: string, blurhash?: string }> {
  const w = getWorker();
  
  if (!w || !window.OffscreenCanvas) {
    // Fallback for extremely old browsers that don't support Web Workers or OffscreenCanvas
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.onload = (e) => {
        const img = new Image()
        img.onerror = () => reject(new Error('Failed to decode image'))
        img.onload = () => {
          const { width, height } = scaleDown(img.width, img.height, MAX_THUMB_DIM)
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(async (blob) => {
            if (blob) resolve({ base64: await blobToBase64(blob) })
            else reject(new Error('Canvas blob failed'))
          }, 'image/jpeg', THUMB_QUALITY)
        }
        img.src = e.target!.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  // State of the Art Web Worker processing
  return new Promise((resolve, reject) => {
    const id = ++jobIdCounter;
    workerPromises.set(id, { resolve, reject });
    w.postMessage({ id, file });
  });
}

/**
 * Generate a base64 JPEG thumbnail from a video File.
 * Seeks to 1 second and captures a single frame.
 */
export function generateVideoThumbnail(file: File): Promise<{ base64: string, blurhash?: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const url = URL.createObjectURL(file)
    video.src = url

    // Timeout to prevent hanging on large videos (especially on mobile)
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('Thumbnail generation timed out'))
    }, 3000)

    video.onerror = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }

    video.onloadeddata = () => {
      video.currentTime = Math.min(VIDEO_SEEK_TIME, video.duration / 2)
    }

    video.onseeked = () => {
      clearTimeout(timer)
      const { width, height } = scaleDown(video.videoWidth, video.videoHeight, MAX_THUMB_DIM)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, width, height)
      
      // Use toBlob instead of toDataURL to prevent main thread blocking
      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(url)
        if (blob) {
          try {
            resolve({ base64: await blobToBase64(blob) })
          } catch (e) {
            reject(new Error('Failed to encode video frame'))
          }
        } else {
          reject(new Error('Canvas blob failed'))
        }
      }, 'image/jpeg', THUMB_QUALITY)
    }
  })
}

/**
 * Generate thumbnail for any media file (auto-detects image vs video).
 */
export async function generateThumbnail(file: File): Promise<{ base64: string, blurhash?: string }> {
  if (file.type.startsWith('video/')) {
    return generateVideoThumbnail(file)
  }
  return generateImageThumbnail(file)
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function scaleDown(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const scale = Math.min(max / w, max / h)
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  }
}
