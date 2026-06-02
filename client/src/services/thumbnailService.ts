/**
 * Thumbnail Service
 * Generates tiny preview thumbnails client-side using Canvas API.
 * Thumbnails are stored as base64 strings directly in the database (~5-15KB each).
 * This means NO cloud storage is needed for previews.
 */

const MAX_THUMB_DIM = 800
const THUMB_QUALITY = 0.8 // high quality
const VIDEO_SEEK_TIME = 1   // capture frame at 1 second

/**
 * Generate a base64 JPEG thumbnail from an image File.
 * Typically produces a 5-15KB string.
 */
export function generateImageThumbnail(file: File): Promise<string> {
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
        const dataUrl = canvas.toDataURL('image/jpeg', THUMB_QUALITY)
        resolve(dataUrl)
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Generate a base64 JPEG thumbnail from a video File.
 * Seeks to 1 second and captures a single frame.
 */
export function generateVideoThumbnail(file: File): Promise<string> {
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
      const dataUrl = canvas.toDataURL('image/jpeg', THUMB_QUALITY)
      URL.revokeObjectURL(url)
      resolve(dataUrl)
    }
  })
}

/**
 * Generate thumbnail for any media file (auto-detects image vs video).
 */
export async function generateThumbnail(file: File): Promise<string> {
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
