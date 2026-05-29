import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Photo } from '@/types'

interface UsePhotoSubscriptionOptions {
  eventId: string
  onNewPhoto?: (photo: Photo) => void
  onPhotoDeleted?: (photoId: string) => void
}

export function usePhotoSubscription({
  eventId,
  onNewPhoto,
  onPhotoDeleted,
}: UsePhotoSubscriptionOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    const callbacksRef = useRef({ onNewPhoto, onPhotoDeleted })
  
    useEffect(() => {
      callbacksRef.current = { onNewPhoto, onPhotoDeleted }
    }, [onNewPhoto, onPhotoDeleted])
  
    useEffect(() => {
      if (!eventId) return
  
      const channel = supabase
        .channel(`photos:event:${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'photos',
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            const raw = payload.new as any
            const photo: Photo = {
              id: raw.id,
              eventId: raw.event_id,
              roomId: raw.room_id,
              uploaderId: raw.uploader_id,
              filename: raw.filename,
              fileSizeBytes: raw.file_size_bytes,
              mediaType: raw.media_type,
              s3Key: raw.s3_key,
              s3Url: raw.s3_url,
              thumbnailUrl: raw.thumbnail_url,
              createdAt: raw.created_at,
              thumbnailBase64: raw.thumbnail_base64,
            }
            callbacksRef.current.onNewPhoto?.(photo)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'photos',
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            callbacksRef.current.onPhotoDeleted?.((payload.old as any).id)
          }
        )
        .subscribe()
  
      channelRef.current = channel
  
      return () => {
        supabase.removeChannel(channel)
      }
    }, [eventId])
}
