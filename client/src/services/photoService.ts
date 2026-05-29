import { supabase } from '@/lib/supabase'
import type { Photo, PhotoWithReactions, Reaction, Comment, MediaType } from '@/types'
import { generateThumbnail } from './thumbnailService'
import { cacheFile, removeCachedFile } from './photoCache'
import { getMediaType } from './uploadService'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapPhoto(data: any): Photo {
  return {
    id: data.id,
    eventId: data.event_id,
    roomId: data.room_id,
    uploaderId: data.uploader_id,
    filename: data.filename,
    contentHash: data.content_hash,
    fileSizeBytes: data.file_size_bytes,
    mediaType: data.media_type as MediaType,
    s3Key: data.s3_key,
    s3Url: data.s3_url,
    thumbnailUrl: data.thumbnail_url,
    thumbnailBase64: data.thumbnail_base64,
    takenAt: data.taken_at,
    cameraMake: data.camera_make,
    cameraModel: data.camera_model,
    iso: data.iso,
    aperture: data.aperture,
    latitude: data.latitude,
    longitude: data.longitude,
    description: data.description,
    createdAt: data.created_at,
  }
}

function mapReaction(data: any): Reaction {
  return {
    id: data.id,
    photoId: data.photo_id,
    userId: data.user_id,
    emoji: data.emoji,
    createdAt: data.created_at,
  }
}

function mapComment(data: any): Comment {
  return {
    id: data.id,
    photoId: data.photo_id,
    userId: data.user_id,
    body: data.body,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

// ─── Photo Upload (P2P Mode) ─────────────────────────────────────────────────

export interface PhotoUploadOptions {
  file: File
  eventId: string
  roomId: string
  userId: string
  onProgress?: (progress: number) => void
}

/**
 * P2P Upload Flow:
 * 1. Generate a tiny thumbnail locally (~10KB)
 * 2. Save metadata + thumbnail_base64 to Supabase DB
 * 3. Cache the full file in IndexedDB
 * 4. File is now servable to peers via WebRTC
 * 
 * NO cloud storage upload happens.
 */
export async function uploadPhotoWithMetadata(
  opts: PhotoUploadOptions
): Promise<{ data: Photo | null; error: string | null }> {
  const { file, eventId, roomId, userId, onProgress } = opts

  try {
    onProgress?.(5)

    // 1. Detect media type
    const mediaType = getMediaType(file)
    if (!mediaType) {
      return { data: null, error: `Unsupported file type: ${file.type}` }
    }

    onProgress?.(15)

    // 2. Generate thumbnail locally
    let thumbnailBase64 = ''
    try {
      thumbnailBase64 = await generateThumbnail(file)
    } catch (e) {
      console.warn('Thumbnail generation failed, continuing without:', e)
    }

    onProgress?.(50)

    // 3. Save metadata + thumbnail to Supabase DB (no file upload!)
    const { data, error } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        room_id: roomId,
        uploader_id: userId,
        filename: file.name,
        file_size_bytes: file.size,
        media_type: mediaType,
        s3_key: `p2p:${userId}:${Date.now()}`, // P2P marker, not a real S3 key
        s3_url: 'https://p2p.local/dummy', // Satisfies the "valid_url" DB constraint
        thumbnail_base64: thumbnailBase64,
      })
      .select()
      .single()

    if (error) throw error

    onProgress?.(80)

    // 4. Cache full file in IndexedDB (persists across refreshes)
    await cacheFile(data.id, file, file.name, file.type)

    onProgress?.(100)

    return { data: mapPhoto(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ─── Photo Listing ───────────────────────────────────────────────────────────

export interface ListPhotosOptions {
  eventId: string
  page?: number
  pageSize?: number
  mediaType?: MediaType
  uploaderId?: string
}

export async function listPhotos(
  opts: ListPhotosOptions
): Promise<{ data: Photo[]; total: number; hasMore: boolean }> {
  const { eventId, page = 1, pageSize = 50, mediaType, uploaderId } = opts

  try {
    let query = supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (mediaType) {
      query = query.eq('media_type', mediaType)
    }
    
    if (uploaderId) {
      query = query.eq('uploader_id', uploaderId)
    }

    const { data, error, count } = await query

    if (error) throw error

    const total = count ?? 0
    return {
      data: (data ?? []).map(mapPhoto),
      total,
      hasMore: total > page * pageSize,
    }
  } catch (err) {
    console.error('listPhotos error:', err)
    return { data: [], total: 0, hasMore: false }
  }
}

// ─── Photo Details ────────────────────────────────────────────────────────────

export async function getPhotoDetails(
  photoId: string
): Promise<PhotoWithReactions | null> {
  try {
    const [photoRes, reactionsRes, commentsRes] = await Promise.all([
      supabase.from('photos').select('*').eq('id', photoId).single(),
      supabase.from('reactions').select('*').eq('photo_id', photoId).order('created_at'),
      supabase
        .from('comments')
        .select('*')
        .eq('photo_id', photoId)
        .order('created_at'),
    ])

    if (photoRes.error || !photoRes.data) return null

    const reactions = (reactionsRes.data ?? []).map(mapReaction)
    const comments = (commentsRes.data ?? []).map(mapComment)

    return {
      ...mapPhoto(photoRes.data),
      reactions,
      comments,
      reactionCount: reactions.length,
      commentCount: comments.length,
    }
  } catch (err) {
    console.error('getPhotoDetails error:', err)
    return null
  }
}

// ─── Photo Deletion ───────────────────────────────────────────────────────────

export async function deletePhotoById(
  photoId: string,
  _s3Key: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('photos').delete().eq('id', photoId)
    if (error) throw error

    // Remove from local IndexedDB cache
    await removeCachedFile(photoId)
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function addReaction(
  photoId: string,
  emoji: string,
  userId: string
): Promise<{ data: Reaction | null; error: string | null }> {
  try {
    // Remove existing reaction with same emoji (toggle)
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('photo_id', photoId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle()

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
      return { data: null, error: null } // toggled off
    }

    const { data, error } = await supabase
      .from('reactions')
      .insert({ photo_id: photoId, user_id: userId, emoji })
      .select()
      .single()

    if (error) throw error
    return { data: mapReaction(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function getReactions(photoId: string): Promise<Reaction[]> {
  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at')

    if (error) throw error
    return (data ?? []).map(mapReaction)
  } catch {
    return []
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function addComment(
  photoId: string,
  body: string,
  userId: string
): Promise<{ data: Comment | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({ photo_id: photoId, user_id: userId, body })
      .select()
      .single()

    if (error) throw error
    return { data: mapComment(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function getComments(photoId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at')

    if (error) throw error
    return (data ?? []).map(mapComment)
  } catch {
    return []
  }
}

export async function deleteComment(
  commentId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}
