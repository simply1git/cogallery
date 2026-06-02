import { supabase } from '@/lib/supabase'
import type { Photo, PhotoWithReactions, Reaction, Comment, MediaType } from '@/types'
import { generateThumbnail } from './thumbnailService'
import { getMediaType } from './uploadService'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapPhoto(data: any): Photo {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  
  let finalS3Url = data.s3_url
  // Auto-heal dead tunnel URLs dynamically based on current .env
  if (finalS3Url && finalS3Url.includes('/stream/')) {
    const parts = finalS3Url.split('/stream/')
    if (parts.length > 1) {
      finalS3Url = `${backendUrl}/stream/${parts[1]}`
    }
  }

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
    s3Url: finalS3Url,
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

export async function uploadPhotoWithMetadata(
  opts: PhotoUploadOptions
): Promise<{ data: Photo | null; error: string | null }> {
  const { file, eventId, roomId, userId, onProgress } = opts

  try {
    onProgress?.(5)

    const mediaType = getMediaType(file)
    if (!mediaType) {
      return { data: null, error: `Unsupported file type: ${file.type}` }
    }

    onProgress?.(10)

    let thumbnailBase64 = ''
    try {
      thumbnailBase64 = await generateThumbnail(file)
    } catch (e) {
      console.warn('Thumbnail generation failed, continuing without:', e)
    }

    onProgress?.(15)

    // Save metadata to Supabase DB to get a unique photo ID
    const { data: photoRow, error: dbError } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        room_id: roomId,
        uploader_id: userId,
        filename: file.name,
        file_size_bytes: file.size,
        media_type: mediaType,
        s3_key: `oracle:pending:${Date.now()}-${Math.random().toString(36).substring(7)}`,
        s3_url: 'https://pending', // will update after upload
        thumbnail_base64: thumbnailBase64,
      })
      .select()
      .single()

    if (dbError) throw dbError
    const photoId = photoRow.id
    onProgress?.(20)

    // Oracle Backend URL
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
    const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    
    // Check for existing chunks (Resumable upload)
    let uploadedChunks: number[] = []
    try {
      const statusRes = await fetch(`${backendUrl}/upload/status/${photoId}`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData.completed) {
          uploadedChunks = Array.from({ length: totalChunks }, (_, i) => i)
        } else if (statusData.chunks) {
          uploadedChunks = statusData.chunks
        }
      }
    } catch (e) {
      console.warn('Could not check upload status, starting fresh', e)
    }

    const MAX_CONCURRENT = 4;
    const pendingChunks = Array.from({ length: totalChunks }, (_, i) => i).filter(i => !uploadedChunks.includes(i));
    let completedCount = totalChunks - pendingChunks.length;
    
    // Concurrent chunk upload queue for state of the art upload speeds
    await new Promise<void>((resolve, reject) => {
      let active = 0;
      let index = 0;
      let hasError = false;

      function next() {
        if (hasError) return;
        if (index >= pendingChunks.length && active === 0) {
          resolve();
          return;
        }
        while (active < MAX_CONCURRENT && index < pendingChunks.length) {
          const chunkIndex = pendingChunks[index++];
          active++;
          
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          chunk.arrayBuffer().then(arrayBuffer => {
            return fetch(`${backendUrl}/upload/chunk`, {
              method: 'POST',
              headers: {
                'x-photo-id': photoId,
                'x-chunk-index': chunkIndex.toString(),
                'x-total-chunks': totalChunks.toString(),
                'x-filename': encodeURIComponent(file.name),
                'x-mime-type': file.type || 'application/octet-stream',
                'Content-Type': 'application/octet-stream'
              },
              body: arrayBuffer
            })
          }).then(res => {
            if (!res.ok) throw new Error(`Upload failed at chunk ${chunkIndex}`);
            active--;
            completedCount++;
            const percent = 20 + Math.round((completedCount / totalChunks) * 80);
            onProgress?.(percent);
            next();
          }).catch(err => {
            hasError = true;
            reject(err);
          });
        }
      }
      next();
    });

    // Finalize URL in database
    const finalUrl = `${backendUrl}/stream/${photoId}`
    const { error: updateError } = await supabase.from('photos').update({
      s3_key: `oracle:${photoId}`,
      s3_url: finalUrl
    }).eq('id', photoId)

    if (updateError) {
      console.error('Failed to update URL in DB:', updateError)
      // Even if DB fails, we still return the updated object locally so the UI works
    }

    photoRow.s3_url = finalUrl
    photoRow.s3_key = `oracle:${photoId}`

    onProgress?.(100)

    return { data: mapPhoto(photoRow), error: null }
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
