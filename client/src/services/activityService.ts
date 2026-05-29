import { supabase } from '@/lib/supabase'

export interface ActivityLog {
  id: string
  roomId: string
  userId: string | null
  action: string
  objectType: string
  objectId: string | null
  details: any
  createdAt: string
}

function mapActivityLog(data: any): ActivityLog {
  return {
    id: data.id,
    roomId: data.room_id,
    userId: data.user_id,
    action: data.action,
    objectType: data.object_type,
    objectId: data.object_id,
    details: data.details,
    createdAt: data.created_at,
  }
}

export async function getActivityLogs(roomId: string, limit = 50): Promise<{ data: ActivityLog[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { data: (data ?? []).map(mapActivityLog), error: null }
  } catch (err: any) {
    return { data: [], error: err.message }
  }
}
