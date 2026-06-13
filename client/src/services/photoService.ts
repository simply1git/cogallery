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
    updatedAt: data.updated_at || data.created_at,
    isEncrypted: data.is_encrypted ?? false,
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
  isEncrypted?: boolean
  onProgress?: (progress: number) => void
}

export async function uploadPhotoWithMetadata(
  opts: PhotoUploadOptions
): Promise<{ data: Photo | null; error: string | null }> {
  const { file, eventId, roomId, userId, isEncrypted, onProgress } = opts
  let photoId: string | null = null;

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
        is_encrypted: isEncrypted ?? false,
      })
      .select()
      .single()

    if (dbError) throw dbError
    photoId = photoRow.id
    onProgress?.(20)

    // 1. Determine Upload Strategy
    const r2Key = `${photoId}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    // Fetch a live node URL from the Distributed Control Plane (DB)
    let targetNodeUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
    try {
      const { data: activeNode, error: nodeError } = await supabase.rpc('get_active_node')
      if (!nodeError && activeNode) {
        targetNodeUrl = activeNode
        console.log(`[P2P Routing] Uploading directly to active node: ${targetNodeUrl}`)
      }
    } catch (e) {
      console.warn("Could not fetch active node, falling back to default.", e)
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    // --- LOCAL ORACLE CHUNKED UPLOAD STRATEGY ---
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    const chunkProgress = new Array(totalChunks).fill(0);
    let hasError = false;
    
    const uploadChunk = async (chunkIndex: number) => {
      if (hasError) return;
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${targetNodeUrl}/upload/chunk`, true);
        
        xhr.setRequestHeader('x-photo-id', r2Key);
        xhr.setRequestHeader('x-chunk-index', chunkIndex.toString());
        xhr.setRequestHeader('x-total-chunks', totalChunks.toString());
        xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
        xhr.setRequestHeader('x-mime-type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            chunkProgress[chunkIndex] = e.loaded;
            const totalLoaded = chunkProgress.reduce((a, b) => a + b, 0);
            const percent = 20 + Math.round((totalLoaded / file.size) * 80);
            onProgress?.(Math.min(percent, 99));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            hasError = true;
            reject(new Error(`Chunk ${chunkIndex} failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          hasError = true;
          reject(new Error('Network error on chunk upload'));
        };
        xhr.send(blob);
      });
    };
    
    // Upload with concurrency of 2
    const concurrency = 2;
    let currentIndex = 0;
    const workers = Array(concurrency).fill(null).map(async () => {
      while (currentIndex < totalChunks) {
        const index = currentIndex++;
        await uploadChunk(index);
      }
    });
    await Promise.all(workers);

    // Finalize URL in database
    // Note: Since we are using zero-trust streams, the s3_url stored here is just a placeholder.
    // The actual viewing URL is generated dynamically via getSecureMediaUrl.
    const finalUrl = `${targetNodeUrl}/stream/${r2Key}`
    const { error: updateError } = await supabase.from('photos').update({
      s3_key: r2Key,
      s3_url: finalUrl
    }).eq('id', photoId)

    if (updateError) {
      console.error('Failed to update URL in DB:', updateError)
    }

    photoRow.s3_url = finalUrl
    photoRow.s3_key = r2Key

    onProgress?.(100)

    return { data: mapPhoto(photoRow), error: null }
  } catch (err: any) {
    if (photoId) {
      // Rollback the ghost preview from Supabase if the upload failed!
      try {
        await supabase.from('photos').delete().eq('id', photoId);
      } catch (deleteError) {
        console.error('Failed to rollback ghost preview:', deleteError);
      }
    }
    return { data: null, error: err.message }
  }
}

export async function getSecureMediaUrl(photo: Pick<Photo, 's3Key' | 's3Url'> & Partial<Pick<Photo, 'filename'>>): Promise<string> {
  let targetNodeUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  
  if (photo.s3Url && photo.s3Url.startsWith('http') && !photo.s3Url.includes('pending')) {
    // ONLY extract origin if it's one of our backend nodes.
    // Legacy Cloudflare R2 urls (.r2.dev) do not host the Node API, so we must fall back to the central backend.
    if (!photo.s3Url.includes('.r2.dev')) {
      try {
        const urlObj = new URL(photo.s3Url);
        targetNodeUrl = urlObj.origin;
      } catch {}
    }
  }

  let s3Key = photo.s3Key;
  if (!s3Key || s3Key.includes('pending')) {
    if (photo.s3Url?.includes('.r2.dev/')) s3Key = photo.s3Url.split('.r2.dev/')[1];
    else if (photo.s3Url?.includes('/stream/')) s3Key = photo.s3Url.split('/stream/')[1];
    else if (photo.s3Url?.includes('/proxy/')) s3Key = photo.s3Url.split('/proxy/')[1];
    else s3Key = photo.filename || '';
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${targetNodeUrl}/media/presign-get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ key: s3Key })
  });

  if (!res.ok) throw new Error('Failed to get secure media url');
  const { url } = await res.json();
  return url.startsWith('http') ? url : `${targetNodeUrl}${url}`;
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
