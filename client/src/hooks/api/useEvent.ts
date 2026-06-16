import { useQuery } from '@tanstack/react-query'
import { getEventById, getEventUploaders } from '@/services/eventService'
import { getRoomById } from '@/services/roomService'
import { getUserProfile } from '@/services/authService'
import type { EventWithDetails, RoomWithMembers } from '@/types'

export function useEvent(eventId?: string, roomId?: string) {
  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEventById(eventId!),
    enabled: !!eventId,
  })

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoomById(roomId!),
    enabled: !!roomId,
  })

  const uploadersQuery = useQuery({
    queryKey: ['eventUploaders', eventId],
    queryFn: async () => {
      const { data } = await getEventUploaders(eventId!)
      if (!data || data.length === 0) return []
      
      const enriched = await Promise.all(
        data.map(async (u) => {
          const { data: profile } = await getUserProfile(u as unknown as string)
          return { 
            id: u as unknown as string, 
            name: profile?.user_metadata?.full_name || profile?.email?.split('@')[0] || 'Unknown User' 
          }
        })
      )
      return enriched
    },
    enabled: !!eventId,
  })

  return {
    event: eventQuery.data?.data as EventWithDetails | null,
    eventError: eventQuery.data?.error || null,
    isLoadingEvent: eventQuery.isLoading,
    room: roomQuery.data?.data as RoomWithMembers | null,
    uploadersList: uploadersQuery.data || [],
  }
}
