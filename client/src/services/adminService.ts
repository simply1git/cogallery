import { supabase } from '../lib/supabase'

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
  max_storage_bytes: number;
  used_storage_bytes: number;
  account_status: string;
  is_admin: boolean;
}

export interface TelemetryData {
  cpuLoad: number[];
  memory: {
    total: number;
    free: number;
    used: number;
    percent: number;
  };
  uptime: number;
  logs: string;
}

export interface GlobalConfig {
  maintenance_mode: boolean;
  signups_disabled: boolean;
  read_only_mode: boolean;
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_get_all_users')
  if (error) throw error
  return data as AdminUser[]
}

export async function updateUserQuota(userId: string, newQuota: number): Promise<void> {
  const { error } = await supabase.rpc('admin_update_quota', { target_uid: userId, new_quota: newQuota })
  if (error) throw error
}

export async function toggleUserBan(userId: string, isBanned: boolean): Promise<void> {
  const status = isBanned ? 'banned' : 'active'
  const { error } = await supabase.rpc('admin_toggle_ban', { target_uid: userId, ban_status: status })
  if (error) throw error
}

export async function getGlobalConfig(): Promise<GlobalConfig> {
  const { data, error } = await supabase.from('global_config').select('*').single()
  if (error) throw error
  return data as GlobalConfig
}

export async function updateGlobalConfig(maintenance: boolean, signups: boolean, readOnly: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_update_global_config', { 
    m_mode: maintenance, 
    s_disabled: signups, 
    r_mode: readOnly 
  })
  if (error) throw error
}

export async function nukeUser(userId: string): Promise<{ deletedFiles: number }> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${backendUrl}/developer/nuke-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      target_uid: userId,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to nuke user')
  }

  return res.json()
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const { data, error } = await supabase.rpc('is_admin', { user_uid: user.id })
  if (error) return false
  return data
}

export async function getTelemetry(): Promise<TelemetryData> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${backendUrl}/developer/telemetry`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) throw new Error('Failed to fetch telemetry');
  return res.json();
}
