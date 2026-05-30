import { supabase } from '@/lib/supabase'
import type { Room, RoomMember, RoomWithMembers, UserRole } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapRoom(data: any): Room {
  return {
    id: data.id,
    creatorId: data.creator_id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    thumbnailUrl: data.thumbnail_url,
    isArchived: data.is_archived ?? false,
    archivedAt: data.archived_at,
  }
}

function mapMember(data: any): RoomMember {
  return {
    id: data.id,
    roomId: data.room_id,
    userId: data.user_id,
    displayName: data.profiles?.display_name || undefined,
    role: data.role as UserRole,
    status: data.status || 'approved',
    invitedById: data.invited_by_id,
    invitedAt: data.invited_at ?? data.created_at,
  }
}

// ─── Room CRUD ───────────────────────────────────────────────────────────────

export async function createRoom(
  userId: string,
  name: string,
  description?: string
): Promise<{ data: Room | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ creator_id: userId, name, description })
      .select()
      .single()

    if (error) throw error

    // Auto-add creator as owner member
    await supabase.from('room_members').insert({
      room_id: data.id,
      user_id: userId,
      role: 'owner',
      status: 'approved',
    })

    return { data: mapRoom(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function getRoomsByUser(userId: string): Promise<RoomWithMembers[]> {
  try {
    // 1. Get rooms where user is an explicitly approved room member
    const { data: memberRows, error: memberErr } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq('status', 'approved')

    if (memberErr) throw memberErr

    // 2. Get rooms where user is an approved event-only member
    const { data: eventRows, error: eventErr } = await supabase
      .from('event_members')
      .select('events!inner(room_id)')
      .eq('user_id', userId)
      .eq('status', 'approved')

    if (eventErr) throw eventErr

    // Combine and deduplicate room IDs
    const roomIds = new Set<string>()
    memberRows?.forEach((r) => roomIds.add(r.room_id))
    eventRows?.forEach((r: any) => {
      if (r.events?.room_id) roomIds.add(r.events.room_id)
    })

    if (roomIds.size === 0) return []

    // 3. Fetch full room details for all collected IDs
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        *,
        room_members(id, user_id, role, status, invited_at, invited_by_id, profiles(display_name))
      `)
      .in('id', Array.from(roomIds))
      .order('created_at', { ascending: false })

    if (error) throw error

    return (rooms ?? []).map((room: any) => ({
      ...mapRoom(room),
      members: (room.room_members ?? []).map(mapMember),
      memberCount: room.room_members?.length ?? 0,
      eventCount: 0, // populated separately when needed
      photoCount: 0,
    }))
  } catch (err) {
    console.error('getRoomsByUser error:', err)
    return []
  }
}

export async function getRoomById(
  roomId: string
): Promise<{ data: RoomWithMembers | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        *,
        room_members(id, user_id, role, status, invited_at, invited_by_id, profiles(display_name))
      `)
      .eq('id', roomId)
      .single()

    if (error) throw error

    const room: RoomWithMembers = {
      ...mapRoom(data),
      members: (data.room_members ?? []).map(mapMember),
      memberCount: data.room_members?.length ?? 0,
      eventCount: 0,
      photoCount: 0,
    }

    return { data: room, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function updateRoom(
  roomId: string,
  updates: { name?: string; description?: string }
): Promise<{ data: Room | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .select()
      .single()

    if (error) throw error
    return { data: mapRoom(data), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export async function deleteRoom(roomId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateRoomThumbnail(roomId: string, thumbnailUrl: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('rooms')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', roomId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function archiveRoom(
  roomId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('rooms')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', roomId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

// ─── Member Management ───────────────────────────────────────────────────────

export async function listMembers(roomId: string): Promise<RoomMember[]> {
  try {
    const { data, error } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)

    if (error) throw error
    return (data ?? []).map(mapMember)
  } catch (err) {
    console.error('listMembers error:', err)
    return []
  }
}

export async function addMemberByEmail(
  roomId: string,
  email: string,
  role: UserRole,
  invitedById: string
): Promise<{ error: string | null }> {
  try {
    // Look up user by email via auth.users view (if exposed) or profiles
    // Fallback: insert with email for invite system
    const { data: userRow, error: userErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (userErr) throw userErr

    if (!userRow) {
      return { error: `No user found with email: ${email}. They must sign up first.` }
    }

    const { error } = await supabase.from('room_members').insert({
      room_id: roomId,
      user_id: userRow.id,
      role,
      status: 'approved', // Direct invites bypass waiting room
      invited_by_id: invitedById,
    })

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function removeMember(
  roomId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateMemberRole(
  roomId: string,
  userId: string,
  role: UserRole
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('room_members')
      .update({ role })
      .eq('room_id', roomId)
      .eq('user_id', userId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getUserRoleInRoom(
  roomId: string,
  userId: string
): Promise<UserRole | null> {
  try {
    const { data, error } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return null
    return data.role as UserRole
  } catch {
    return null
  }
}

export async function requestToJoinRoom(
  roomId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('room_members').insert({
      room_id: roomId,
      user_id: userId,
      role: 'viewer', // default role
      status: 'pending',
    })

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateMemberStatus(
  roomId: string,
  userId: string,
  status: 'approved' | 'rejected'
): Promise<{ error: string | null }> {
  try {
    if (status === 'rejected') {
      // Just delete the request
      return removeMember(roomId, userId)
    }

    const { error } = await supabase
      .from('room_members')
      .update({ status })
      .eq('room_id', roomId)
      .eq('user_id', userId)

    if (error) throw error
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getRoomAnalytics(roomId: string) {
  try {
    const { data: photos, error } = await supabase
      .from('photos')
      .select('uploader_id, file_size_bytes, media_type')
      .eq('room_id', roomId)

    if (error) throw error

    let totalSize = 0
    let photoCount = 0
    let videoCount = 0
    const uploaderStats: Record<string, { count: number; size: number }> = {}

    photos?.forEach(photo => {
      totalSize += photo.file_size_bytes || 0
      if (photo.media_type === 'video') videoCount++
      else photoCount++

      if (!uploaderStats[photo.uploader_id]) {
        uploaderStats[photo.uploader_id] = { count: 0, size: 0 }
      }
      uploaderStats[photo.uploader_id].count++
      uploaderStats[photo.uploader_id].size += photo.file_size_bytes || 0
    })

    const topContributors = Object.entries(uploaderStats)
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return { totalSize, photoCount, videoCount, topContributors, error: null }
  } catch (err: any) {
    return { error: err.message, totalSize: 0, photoCount: 0, videoCount: 0, topContributors: [] }
  }
}
