import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface PresenceUser {
  id: string
  displayName: string
  avatarUrl?: string
  lastActive: string
}

export function usePresence(roomId: string, eventId?: string) {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!user || !roomId) return

    const channelName = eventId ? `presence:room_${roomId}:event_${eventId}` : `presence:room_${roomId}`
    const channel = supabase.channel(channelName)

    const userState: PresenceUser = {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      lastActive: new Date().toISOString()
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state)
          .flat()
          .map((p: any) => p as PresenceUser)
        
        // Deduplicate by ID
        const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values())
        setOnlineUsers(uniqueUsers)
      })
      .on('presence', { event: 'join' }, () => {
        // sync will handle state updates
      })
      .on('presence', { event: 'leave' }, () => {
        // sync will handle state updates
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userState)
        }
      })

    // Periodic untrack/track to update lastActive time
    const interval = setInterval(() => {
      channel.track({ ...userState, lastActive: new Date().toISOString() })
    }, 60000)

    return () => {
      clearInterval(interval)
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [roomId, eventId, user?.id, user?.displayName, user?.avatarUrl])

  return { onlineUsers }
}
