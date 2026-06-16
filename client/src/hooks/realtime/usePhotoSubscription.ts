import { useEffect, useRef, useState } from 'react'
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
  
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    callbacksRef.current = { onNewPhoto, onPhotoDeleted }
  }, [onNewPhoto, onPhotoDeleted])

  useEffect(() => {
    if (!eventId) return

    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout>

    const subscribeWithRetry = () => {
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
              updatedAt: raw.updated_at || raw.created_at,
              thumbnailBase64: raw.thumbnail_base64,
              isEncrypted: raw.is_encrypted || false,
            }
            callbacksRef.current.onNewPhoto?.(photo)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
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
              updatedAt: raw.updated_at || raw.created_at,
              thumbnailBase64: raw.thumbnail_base64,
              isEncrypted: raw.is_encrypted || false,
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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            setIsReconnecting(false)
            retryCount = 0
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsConnected(false)
            setIsReconnecting(true)
            
            // Clean up the broken channel before creating a new one
            supabase.removeChannel(channel)
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
            retryCount++
            
            clearTimeout(retryTimer)
            retryTimer = setTimeout(() => {
              subscribeWithRetry()
            }, delay)
          }
        })

      channelRef.current = channel
    }

    subscribeWithRetry()

    return () => {
      clearTimeout(retryTimer)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [eventId])

  return { isConnected, isReconnecting }
}
