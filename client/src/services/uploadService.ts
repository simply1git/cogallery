import { supabase } from '@/lib/supabase'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

/**
 * Upload Service
 * Handles photo & video uploads to Cloudflare R2 (high-performance multipart)
 * with automatic fallback to Supabase Storage if R2 is not configured.
 * No file size limit — unlimited uploads.
 */

export interface UploadProgress {
  fileName: string
  progress: number // 0-100
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export interface UploadResult {
  success: boolean
  url?: string
  storagePath?: string
  photoId?: string
  error?: string
  fileName: string
  mediaType?: 'image' | 'video'
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/bmp',
]

const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/3gpp',
  'video/mpeg',
  'video/mov',
]

export const ACCEPTED_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES]

// ─── R2 Configuration ────────────────────────────────────────────────────────
const r2AccessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID
const r2SecretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY
const r2Endpoint = import.meta.env.VITE_R2_ENDPOINT
const r2BucketName = import.meta.env.VITE_R2_BUCKET_NAME
const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL

const isR2Enabled = !!(r2AccessKeyId && r2SecretAccessKey && r2Endpoint && r2BucketName && r2PublicUrl)

let r2Client: S3Client | null = null

if (isR2Enabled) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
    maxAttempts: 5, // Auto-retry dropped chunks up to 5 times
  })
}

export function getMediaType(file: File): 'image' | 'video' | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'image'
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return 'video'
  // Fallback: check extension
  const ext = file.name.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tiff', 'bmp']
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', '3gp', 'mpeg', 'mpg', 'm4v']
  if (ext && imageExts.includes(ext)) return 'image'
  if (ext && videoExts.includes(ext)) return 'video'
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Upload a single photo or video
 * Automatically uses Cloudflare R2 if configured, else falls back to Supabase.
 */
export async function uploadMedia(
  file: File,
  eventId: string,
  roomId: string,
  _userId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    if (!file) {
      return { success: false, error: 'No file selected', fileName: '' }
    }

    const mediaType = getMediaType(file)
    if (!mediaType) {
      return {
        success: false,
        error: `Unsupported file type: ${file.type || file.name.split('.').pop()}`,
        fileName: file.name,
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop() || (mediaType === 'image' ? 'jpg' : 'mp4')
    const fileName = `${timestamp}-${random}.${extension}`

    // Storage path: rooms/{roomId}/events/{eventId}/{fileName}
    const storagePath = `rooms/${roomId}/events/${eventId}/${fileName}`

    if (isR2Enabled && r2Client) {
      // ─── Cloudflare R2 High-Performance Upload ───────────────────────────
      onProgress?.(5)

      // Use chunked multipart upload for infinite size files & maximum speed
      const upload = new Upload({
        client: r2Client,
        params: {
          Bucket: r2BucketName,
          Key: storagePath,
          Body: file,
          ContentType: file.type,
        },
        queueSize: 4, // 4 parallel chunks
        partSize: 1024 * 1024 * 5, // 5MB chunk size
        leavePartsOnError: false,
      })

      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percentage = Math.round((progress.loaded / progress.total) * 100)
          // Scale progress safely between 5% and 95%
          onProgress?.(Math.min(95, 5 + Math.round(percentage * 0.9)))
        }
      })

      await upload.done()

      const publicUrl = `${r2PublicUrl.replace(/\/$/, '')}/${storagePath}`
      onProgress?.(100)

      return {
        success: true,
        url: publicUrl,
        storagePath,
        fileName: file.name,
        mediaType,
      }
    } else {
      // ─── Fallback: Supabase Storage ───────────────────────────────────────
      onProgress?.(10)

      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(storagePath, file, {
          cacheControl: '31536000',
          upsert: false,
        })

      if (uploadError) {
        return {
          success: false,
          error: uploadError.message,
          fileName: file.name,
        }
      }

      if (!data) {
        return {
          success: false,
          error: 'Upload failed: No data returned',
          fileName: file.name,
        }
      }

      onProgress?.(90)

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(storagePath)

      if (!urlData?.publicUrl) {
        return {
          success: false,
          error: 'Failed to generate public URL',
          fileName: file.name,
        }
      }

      onProgress?.(100)

      return {
        success: true,
        url: urlData.publicUrl,
        storagePath,
        fileName: file.name,
        mediaType,
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      error: errorMessage,
      fileName: file.name,
    }
  }
}

/**
 * Upload an avatar image for a user
 */
export async function uploadAvatar(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    if (!file) return { success: false, error: 'No file', fileName: '' }

    const mediaType = getMediaType(file)
    if (mediaType !== 'image') return { success: false, error: 'Only images are allowed for avatars', fileName: file.name }

    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}.${extension}`
    const storagePath = `avatars/${userId}/${fileName}`

    if (isR2Enabled && r2Client) {
      onProgress?.(10)
      const upload = new Upload({
        client: r2Client,
        params: {
          Bucket: r2BucketName,
          Key: storagePath,
          Body: file,
          ContentType: file.type,
        },
      })

      await upload.done()
      const publicUrl = `${r2PublicUrl.replace(/\/$/, '')}/${storagePath}`
      onProgress?.(100)

      return { success: true, url: publicUrl, storagePath, fileName, mediaType: 'image' }
    } else {
      onProgress?.(10)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, { cacheControl: '31536000', upsert: true })

      if (uploadError) return { success: false, error: uploadError.message, fileName }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath)
      onProgress?.(100)

      return { success: true, url: urlData.publicUrl, storagePath, fileName, mediaType: 'image' }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error', fileName: file.name }
  }
}

/**
 * Upload a thumbnail image for a Room or Event
 */
export async function uploadThumbnail(
  file: File,
  entityId: string, // Room ID or Event ID
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    if (!file) return { success: false, error: 'No file', fileName: '' }

    const mediaType = getMediaType(file)
    if (mediaType !== 'image') return { success: false, error: 'Only images are allowed for covers', fileName: file.name }

    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}.${extension}`
    const storagePath = `thumbnails/${entityId}/${fileName}`

    if (isR2Enabled && r2Client) {
      onProgress?.(10)
      const upload = new Upload({
        client: r2Client,
        params: {
          Bucket: r2BucketName,
          Key: storagePath,
          Body: file,
          ContentType: file.type,
        },
      })

      await upload.done()
      const publicUrl = `${r2PublicUrl.replace(/\/$/, '')}/${storagePath}`
      onProgress?.(100)

      return { success: true, url: publicUrl, storagePath, fileName, mediaType: 'image' }
    } else {
      onProgress?.(10)
      const { error: uploadError } = await supabase.storage
        .from('photos') // Reusing photos bucket for thumbnails
        .upload(storagePath, file, { cacheControl: '31536000', upsert: true })

      if (uploadError) return { success: false, error: uploadError.message, fileName }

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath)
      onProgress?.(100)

      return { success: true, url: urlData.publicUrl, storagePath, fileName, mediaType: 'image' }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error', fileName: file.name }
  }
}


/**
 * Upload multiple files in batch
 */
export async function uploadMediaBatch(
  files: File[],
  eventId: string,
  roomId: string,
  userId: string,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (let i = 0; i < files.length; i++) {
    const result = await uploadMedia(files[i], eventId, roomId, userId, (progress) => {
      onProgress?.(i, progress)
    })
    results.push(result)
  }

  return results
}

/**
 * Delete a file from storage
 */
export async function deleteStorageFile(storagePath: string): Promise<boolean> {
  try {
    if (isR2Enabled && r2Client) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2BucketName,
          Key: storagePath,
        })
      )
      return true
    } else {
      const { error } = await supabase.storage.from('photos').remove([storagePath])
      if (error) {
        console.error('Delete failed:', error)
        return false
      }
      return true
    }
  } catch (err) {
    console.error('Delete error:', err)
    return false
  }
}

/**
 * Get a thumbnail transform URL
 */
export function getThumbnailUrl(
  publicUrl: string,
  width = 400,
  height = 400,
  quality = 80
): string {
  // Cloudflare R2 has its own resize API, but if it is using a public custom domain,
  // we just return the public URL directly to let the browser handle it.
  if (isR2Enabled) {
    return publicUrl
  }

  // Supabase image transformation
  try {
    const url = new URL(publicUrl)
    url.searchParams.set('width', String(width))
    url.searchParams.set('height', String(height))
    url.searchParams.set('quality', String(quality))
    url.searchParams.set('resize', 'cover')
    return url.toString()
  } catch {
    return publicUrl
  }
}

// Legacy compat exports
export const uploadPhoto = uploadMedia
export const uploadPhotoBatch = uploadMediaBatch
export const deletePhoto = deleteStorageFile
