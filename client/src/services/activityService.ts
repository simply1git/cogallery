import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

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

// Audit logging functions for security-sensitive events
export async function logAuthEvent(
  action: 'sign_in' | 'sign_up' | 'sign_out' | 'password_update' | 'password_reset',
  userId: string | null,
  email: string | null = null,
  success: boolean = true,
  errorMessage: string | null = null,
  ipAddress: string | null = null,
  userAgent: string | null = null
): Promise<{ error: string | null }> {
  try {
    const { error: dbError } = await supabase
      .from('activity_log')
      .insert({
        room_id: null, // Auth events are not tied to a specific room
        user_id: userId,
        action: `auth_${action}`,
        object_type: 'user',
        object_id: userId,
        details: {
          email,
          success,
          ...(errorMessage && { error: errorMessage }),
          ...(ipAddress && { ip: ipAddress }),
          ...(userAgent && { user_agent: userAgent })
        }
      })

    if (dbError) throw dbError
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function logRoomEvent(
  action: 'create' | 'update' | 'delete' | 'archive' | 'unarchive',
  roomId: string,
  userId: string,
  roomName: string | null = null,
  isVault: boolean | null = null,
  additionalDetails: Record<string, any> = {}
): Promise<{ error: string | null }> {
  try {
    const { error: dbError } = await supabase
      .from('activity_log')
      .insert({
        room_id: roomId,
        user_id: userId,
        action: `room_${action}`,
        object_type: 'room',
        object_id: roomId,
        details: {
          room_name: roomName,
          is_vault: isVault,
          ...additionalDetails
        }
      })

    if (dbError) throw dbError
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function logMemberEvent(
  action: 'add' | 'remove' | 'role_update' | 'request' | 'status_update' | 'join_request',
  roomId: string,
  userId: string | null, // Performing user's ID
  targetUserId: string | null, // Target user's ID (if applicable)
  role: UserRole | null = null,
  status: string | null = null,
  additionalDetails: Record<string, any> = {}
): Promise<{ error: string | null }> {
  try {
    const { error: dbError } = await supabase
      .from('activity_log')
      .insert({
        room_id: roomId,
        user_id: userId,
        action: `member_${action}`,
        object_type: 'room_member',
        object_id: targetUserId ?? roomId, // For member-specific actions, use user ID; otherwise room ID
        details: {
          target_user_id: targetUserId,
          role,
          status,
          ...additionalDetails
        }
      })

    if (dbError) throw dbError
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function logVaultEvent(
  action: 'create' | 'access' | 'recovery_attempt' | 'recovery_success' | 'key_rotation',
  roomId: string,
  userId: string | null,
  success: boolean = true,
  errorMessage: string | null = null,
  additionalDetails: Record<string, any> = {}
): Promise<{ error: string | null }> {
  try {
    const { error: dbError } = await supabase
      .from('activity_log')
      .insert({
        room_id: roomId,
        user_id: userId,
        action: `vault_${action}`,
        object_type: 'vault',
        object_id: roomId,
        details: {
          success,
          ...(errorMessage && { error: errorMessage }),
          ...additionalDetails
        }
      })

    if (dbError) throw dbError
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function logPhotoEvent(
  action: 'upload' | 'delete' | 'decrypt',
  roomId: string,
  userId: string,
  photoId: string,
  isEncrypted: boolean = false,
  mediaType: string | null = null,
  additionalDetails: Record<string, any> = {}
): Promise<{ error: string | null }> {
  try {
    const { error: dbError } = await supabase
      .from('activity_log')
      .insert({
        room_id: roomId,
        user_id: userId,
        action: `photo_${action}`,
        object_type: 'photo',
        object_id: photoId,
        details: {
          is_encrypted: isEncrypted,
          media_type: mediaType,
          ...additionalDetails
        }
      })

    if (dbError) throw dbError
    return { error: null }
  } catch (err: any) {
    return { error: err.message }
  }
}
