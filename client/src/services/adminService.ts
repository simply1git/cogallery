import { supabase } from '../lib/supabase'

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
  max_storage_bytes: number;
  used_storage_bytes: number;
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

export async function getAllUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_get_all_users')
  if (error) throw error
  return data as AdminUser[]
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
