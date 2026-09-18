// @ts-nocheck
import { supabase } from '@/lib/supabase'
import type { Photo, PhotoWithReactions, Reaction, Comment, MediaType } from '@/types'
import { generateThumbnail } from './thumbnailService'
import { getMediaType } from './uploadService'
import { decryptBuffer } from './cryptoService'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { processPhotoWithAITags } from './aiTaggingService'
import { logPhotoEvent } from '@/services/activityService'

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
    blurhash: data.blurhash,
    takenAt: data.taken_at,
    cameraMake: data.camera_make,
    cameraModel: data.camera_model,
    iso: data.iso,
    aperture: data.aperture,
    latitude: data.latitude,
    longitude: data.longitude,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at || data.created_at,
    isEncrypted: data.is_encrypted ?? false,
    metadata: data.metadata,
    aiTags: data.metadata?.aiTags
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

// ─── Retry Helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError!
}

// ─── Photo Upload (P2P Mode) ─────────────────────────────────────────────────


export async function getSecureMediaUrl(
  photo: Pick<Photo, 's3Key' | 's3Url'> & Partial<Pick<Photo, 'filename'>>,
  type: 'stream' | 'preview' | 'resize' = 'stream',
  options?: { width?: number; height?: number; quality?: number }
): Promise<{url: string, hlsUrl?: string}> {
  let targetNodeUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  
  const p = photo as any;
  const actualS3Url = photo.s3Url || p.s3_url;
  let s3Key = photo.s3Key || p.s3_key;

  if (actualS3Url && actualS3Url.startsWith('http') && !actualS3Url.includes('pending')) {
    // ONLY extract origin if it's one of our backend nodes.
    // Legacy Cloudflare R2 urls (.r2.dev) do not host the Node API, so we must fall back to the central backend.
    if (!actualS3Url.includes('.r2.dev')) {
      try {
        const urlObj = new URL(actualS3Url);
        targetNodeUrl = urlObj.origin;
      } catch {}
    }
  }

  if (!s3Key || s3Key.includes('pending')) {
    if (actualS3Url?.includes('.r2.dev/')) s3Key = actualS3Url.split('.r2.dev/')[1];
    else if (actualS3Url?.includes('/stream/')) s3Key = actualS3Url.split('/stream/')[1];
    else if (actualS3Url?.includes('/preview/')) s3Key = actualS3Url.split('/preview/')[1];
    else if (actualS3Url?.includes('/resize/')) s3Key = actualS3Url.split('/resize/')[1];
  }

  if (!s3Key) throw new Error('Missing S3 key');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${targetNodeUrl}/media/presign-get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ key: s3Key, type, ...options })
  });

  if (!res.ok) throw new Error('Failed to get secure media url');
  const { url, hlsUrl } = await res.json();
  return { 
    url: url.startsWith('http') ? url : `${targetNodeUrl}${url}`,
    hlsUrl: hlsUrl ? (hlsUrl.startsWith('http') ? hlsUrl : `${targetNodeUrl}${hlsUrl}`) : undefined
  };
}

export async function downloadAndDecryptMedia(
  photo: Photo,
  vaultKey: CryptoKey,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  const { url: secureUrl } = await getSecureMediaUrl(photo);
  const response = await fetch(secureUrl);
  if (!response.ok) throw new Error('Failed to fetch encrypted media');

  const totalBytes = Number(response.headers.get('Content-Length')) || photo.fileSizeBytes;
  const mimeType = photo.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

  if (!response.body) {
    const encryptedBuffer = await response.arrayBuffer();
    const decryptedBlob = await decryptBuffer(encryptedBuffer, vaultKey, mimeType);

    // Audit log photo decryption (access)
    await logPhotoEvent('decrypt', photo.room_id, null, photo.id, photo.is_encrypted ?? false, photo.media_type)

    return URL.createObjectURL(decryptedBlob);
  }

  const reader = response.body.getReader();
  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];

  let isDone = false;
  while (!isDone) {
    const { done, value } = await reader.read();
    if (done) {
      isDone = true;
      break;
    }

    if (value) {
      chunks.push(value);
      receivedBytes += value.length;
      onProgress?.(receivedBytes, totalBytes);
    }
  }

  const concatenated = new Uint8Array(receivedBytes);
  let position = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, position);
    position += chunk.length;
  }

  const decryptedBlob = await decryptBuffer(concatenated.buffer, vaultKey, mimeType);

  // Audit log photo decryption (access)
  await logPhotoEvent('decrypt', photo.room_id, null, photo.id, photo.is_encrypted ?? false, photo.media_type)

  return URL.createObjectURL(decryptedBlob);
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
      supabase.from('photos').select('*').eq('id', photoId).maybeSingle(),
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
    const { data, error } = await supabase.from('photos').delete().eq('id', photoId).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error("Permission denied or photo already deleted")

    // We should also delete the file from the distributed storage cluster here, but
    // for now we rely on the nuke-user or cleanup jobs to handle dangling files,
    // or we can implement an RPC/fetch to the active nodes later.

    // Audit log photo deletion
    // We need to get the roomId, userId, and isEncrypted from the photo data
    // Since we deleted it, we need to get this info before deletion or from the data parameter
    if (data && data.length > 0) {
      const photo = data[0];
      await logPhotoEvent('delete', photo.room_id, photo.uploader_id, photoId, photo.is_encrypted ?? false, photo.media_type)
    }

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
      // Audit log reaction removal (toggle off)
      // Need to get photo info to determine roomId
      const { data: photoData } = await supabase
        .from('photos')
        .select('room_id')
        .eq('id', photoId)
        .single()

      if (photoData) {
        await logPhotoEvent('reaction_removed', photoData.room_id, null, photoId, false, null, {
          emoji
        })
      }

      return { data: null, error: null } // toggled off
    }

    const { data, error } = await supabase
      .from('reactions')
      .insert({ photo_id: photoId, user_id: userId, emoji })
      .select()
      .single()

    if (error) throw error

    // Audit log reaction addition
    // Need to get photo info to determine roomId
    const { data: photoData } = await supabase
      .from('photos')
      .select('room_id')
      .eq('id', photoId)
      .single()

    if (photoData) {
      await logPhotoEvent('reaction_added', photoData.room_id, userId, photoId, false, null, {
        emoji
      })
    }

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

    // Audit log comment addition
    // Need to get photo info to determine roomId
    const { data: photoData } = await supabase
      .from('photos')
      .select('room_id')
      .eq('id', photoId)
      .single()

    if (photoData) {
      await logPhotoEvent('comment_added', photoData.room_id, userId, photoId, false, null, {
        body: body.substring(0, Math.min(body.length, 100)) // Truncate for privacy/storage
      })
    }

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

    // Audit log comment deletion
    // Need to get comment info to determine photoId and then roomId
    const { data: commentData } = await supabase
      .from('comments')
      .select('photo_id')
      .eq('id', commentId)
      .single()

    if (commentData) {
      // Get photo info to get roomId
      const { data: photoData } = await supabase
        .from('photos')
        .select('room_id')
        .eq('id', commentData.photo_id)
        .single()

      if (photoData) {
        await logPhotoEvent('comment_deleted', photoData.room_id, null, commentData.photo_id, false, null, {})
      }
    }

    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}
