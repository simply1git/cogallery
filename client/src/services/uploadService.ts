import { supabase } from '@/lib/supabase'

/**
 * Upload Service
 * Handles small uploads (avatars, thumbnails) directly to Supabase.
 * Large media uploads have been migrated to the Oracle chunked upload system in photoService.ts
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

    onProgress?.(10)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, { cacheControl: '31536000', upsert: true })

    if (uploadError) return { success: false, error: uploadError.message, fileName }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath)
    onProgress?.(100)

    return { success: true, url: urlData.publicUrl, storagePath, fileName, mediaType: 'image' }
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

    onProgress?.(10)
    const { error: uploadError } = await supabase.storage
      .from('photos') // Reusing photos bucket for thumbnails
      .upload(storagePath, file, { cacheControl: '31536000', upsert: true })

    if (uploadError) return { success: false, error: uploadError.message, fileName }

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath)
    onProgress?.(100)

    return { success: true, url: urlData.publicUrl, storagePath, fileName, mediaType: 'image' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error', fileName: file.name }
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
