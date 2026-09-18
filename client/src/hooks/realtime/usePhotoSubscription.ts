import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Photo } from '@/types'

interface UsePhotoSubscriptionOptions {
  eventId: string
  onNewPhoto?: (photo: Photo) => void
  onPhotoDeleted?: (photoId: string) => void
  onReconnect?: () => void
}

export function usePhotoSubscription({
  eventId,
  onNewPhoto,
  onPhotoDeleted,
  onReconnect,
}: UsePhotoSubscriptionOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const callbacksRef = useRef({ onNewPhoto, onPhotoDeleted, onReconnect })
  
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    callbacksRef.current = { onNewPhoto, onPhotoDeleted, onReconnect }
  }, [onNewPhoto, onPhotoDeleted, onReconnect])

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
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false)
          if (status !== 'CLOSED') {
            setIsReconnecting(true)
          }
        }
      })

    channelRef.current = channel

    // -------------------------------------------------------------
    // ELITE FEATURE: Stale-While-Revalidate Sync Recovery
    // -------------------------------------------------------------
    const handleReconnect = () => {
      // If the user's browser comes back online or they switch tabs back,
      // we immediately fetch any data they might have missed while disconnected.
      if (callbacksRef.current.onReconnect) {
        callbacksRef.current.onReconnect()
      }
    }

    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleReconnect()
      }
    })

    return () => {
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleReconnect)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [eventId])
  
  return { isConnected, isReconnecting }
}
