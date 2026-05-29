import { supabase } from '@/lib/supabase'
import type { Event, EventMember, EventWithDetails, UserRole } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapEvent(data: any): Event {
  return {
    id: data.id,
    roomId: data.room_id,
    creatorId: data.creator_id,
    title: data.title,
    description: data.description,
    notes: data.notes ?? '',
    thumbnailUrl: data.thumbnail_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function mapEventMember(data: any): EventMember {
  return {
    id: data.id,
    eventId: data.event_id,
    userId: data.user_id,
    role: data.role,
    status: data.status || 'approved',
    joinedAt: data.joined_at || data.created_at,
  }
}

// ─── Event CRUD (Room-Scoped) ────────────────────────────────────────────────

export async function createEvent(
  roomId: string,
  title: string,
  description: string | undefined,
  userId: string
): Promise<{ data: Event | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert({ room_id: roomId, creator_id: userId, title, description })
      .select()
      .single()

    if (error) throw error

    // Note: event_members insertion is now automatically handled by the on_event_created Postgres trigger
    // which safely adds both the event creator and the room creator as owners.

    return { data: mapEvent(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function getEventsByRoom(roomId: string): Promise<EventWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_members(id, event_id, user_id, role, status, joined_at),
        photos(id)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((ev: any) => ({
      ...mapEvent(ev),
      members: (ev.event_members ?? []).map(mapEventMember),
      photoCount: ev.photos?.length ?? 0,
      participantCount: ev.event_members?.length ?? 0,
    }))
  } catch (err) {
    console.error('getEventsByRoom error:', err)
    return []
  }
}

export async function getEventsByUser(userId: string): Promise<EventWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_members!inner(id, event_id, user_id, role, status, joined_at),
        photos(id)
      `)
      .eq('event_members.user_id', userId)
      .eq('event_members.status', 'approved')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((ev: any) => ({
      ...mapEvent(ev),
      members: (ev.event_members ?? []).map(mapEventMember),
      photoCount: ev.photos?.length ?? 0,
      participantCount: ev.event_members?.length ?? 0,
    }))
  } catch (err) {
    console.error('getEventsByUser error:', err)
    return []
  }
}


export async function updateEventThumbnail(eventId: string, thumbnailUrl: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('events')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', eventId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getEventById(
  eventId: string
): Promise<{ data: EventWithDetails | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_members(id, event_id, user_id, role, status, joined_at),
        photos(id)
      `)
      .eq('id', eventId)
      .single()

    if (error) throw error

    return {
      data: {
        ...mapEvent(data),
        members: (data.event_members ?? []).map(mapEventMember),
        photoCount: data.photos?.length ?? 0,
        participantCount: data.event_members?.length ?? 0,
      },
      error: null,
    }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function updateEvent(
  eventId: string,
  updates: { title?: string; description?: string; notes?: string }
): Promise<{ data: Event | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single()

    if (error) throw error
    return { data: mapEvent(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function deleteEvent(
  eventId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function addEventMember(
  eventId: string,
  userId: string,
  role: UserRole = 'viewer'
): Promise<{ error: string | null }> {
  try {
    // Check if already member
    const { data: existing } = await supabase
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return { error: null }

    const { error } = await supabase
      .from('event_members')
      .insert({ event_id: eventId, user_id: userId, role, status: 'approved' })

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function requestToJoinEvent(
  eventId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('event_members').insert({
      event_id: eventId,
      user_id: userId,
      role: 'viewer',
      status: 'pending',
    })

    if (error) {
      // 23505 is the PostgreSQL error code for unique_violation.
      // If they already requested, treat it as a success.
      if (error.code === '23505') {
        return { error: null }
      }
      throw error
    }
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateEventMemberStatus(
  eventId: string,
  userId: string,
  status: 'approved' | 'rejected'
): Promise<{ error: string | null }> {
  try {
    if (status === 'rejected') {
      const { error } = await supabase
        .from('event_members')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId)
      if (error) throw error
      return { error: null }
    }

    const { error } = await supabase
      .from('event_members')
      .update({ status })
      .eq('event_id', eventId)
      .eq('user_id', userId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function addEventMemberByEmail(
  eventId: string,
  email: string,
  role: 'editor' | 'viewer'
): Promise<{ error: string | null }> {
  try {
    // 1. Get user by email (from profiles/users table or auth lookup if possible)
    // Actually, in our setup we rely on a custom profiles table or we can query users directly if they exist
    // But since supabase edge functions or RPC is usually needed to lookup auth.users,
    // we assume we have a profiles table or we just do a direct lookup if we have public profiles.
    // For now, let's just use the same logic we used in roomService.
    const { data: userRecord, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !userRecord) {
      return { error: 'User with this email not found. They must sign up first.' }
    }

    const { error } = await supabase.from('event_members').insert({
      event_id: eventId,
      user_id: userRecord.id,
      role,
      status: 'approved',
    })

    if (error) {
      if (error.code === '23505') return { error: 'User is already an event member' }
      throw error
    }

    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getEventUploaders(eventId: string) {
  try {
    const { data: photos, error } = await supabase
      .from('photos')
      .select('uploader_id')
      .eq('event_id', eventId)

    if (error) throw error

    const uniqueUploaderIds = Array.from(new Set(
      photos?.map(p => p.uploader_id).filter(Boolean) || []
    ))
    return { data: uniqueUploaderIds, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}
