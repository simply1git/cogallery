import { useEffect, useState } from 'react'
import { Activity, Users, Shield, Server, Terminal, Lock, HardDrive } from 'lucide-react'
import { AdminUser, TelemetryData, getAllUsers, getTelemetry, checkIsAdmin } from '@/services/adminService'
import { formatFileSize } from '@/services/uploadService'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export function DeveloperDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'server'>('server')
  const navigate = useNavigate()

  useEffect(() => {
    checkIsAdmin().then(admin => {
      setIsAdmin(admin)
      if (!admin) {
        toast.error('Access Denied. You are not a platform admin.')
        navigate('/')
      }
    })
  }, [navigate])

  useEffect(() => {
    if (!isAdmin) return
    if (activeTab === 'users') {
      getAllUsers().then(setUsers).catch(err => toast.error(err.message))
    }
  }, [isAdmin, activeTab])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'server') return
    // Poll telemetry every 5 seconds
    const fetchTelemetry = () => getTelemetry().then(setTelemetry).catch(console.error)
    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 5000)
    return () => clearInterval(interval)
  }, [isAdmin, activeTab])

  if (isAdmin === null) return <div className="p-8 flex justify-center"><Activity className="animate-spin" /></div>
  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-purple-500/20 border border-red-500/30 flex items-center justify-center">
            <Shield className="text-red-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-purple-400">
              God Mode Dashboard
            </h1>
            <p className="text-white/50 text-sm">Zero-Master-Key Administrative Control</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('server')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'server' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Server size={16} /> Oracle Server
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'users' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Users size={16} /> User Management
          </button>
        </div>

        {/* Content */}
        {activeTab === 'server' && telemetry && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-white/50 mb-4"><Activity size={16}/> CPU Load (1m, 5m, 15m)</div>
                <div className="text-2xl font-mono">{telemetry.cpuLoad[0].toFixed(2)}</div>
                <div className="text-xs text-white/30">{telemetry.cpuLoad[1].toFixed(2)} / {telemetry.cpuLoad[2].toFixed(2)}</div>
              </div>
              <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-white/50 mb-4"><HardDrive size={16}/> Memory Usage</div>
                <div className="text-2xl font-mono">{telemetry.memory.percent}%</div>
                <div className="text-xs text-white/30">{formatFileSize(telemetry.memory.used)} / {formatFileSize(telemetry.memory.total)}</div>
                <div className="w-full bg-black/50 rounded-full h-1 mt-2">
                  <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${telemetry.memory.percent}%` }} />
                </div>
              </div>
              <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-white/50 mb-4"><Server size={16}/> Server Uptime</div>
                <div className="text-2xl font-mono">{Math.floor(telemetry.uptime / 3600)}h {Math.floor((telemetry.uptime % 3600) / 60)}m</div>
                <div className="text-xs text-[#00ff00]">PM2 Process Online</div>
              </div>
            </div>

            {/* Terminal */}
            <div className="bg-black border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2 text-xs font-mono text-white/50">
                <Terminal size={14} /> Live PM2 Logs (cogallery-seedbox)
              </div>
              <pre className="p-4 text-xs font-mono text-[#00ff00] h-[400px] overflow-y-auto whitespace-pre-wrap">
                {telemetry.logs}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-white/50 uppercase bg-black/50 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Storage Used</th>
                    <th className="px-6 py-4">Quota</th>
                    <th className="px-6 py-4">Joined</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.map(u => {
                    const usagePercent = u.max_storage_bytes ? (u.used_storage_bytes / u.max_storage_bytes) * 100 : 0
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-8 h-8 rounded-full bg-white/10" />
                            <div>
                              <div className="font-medium text-white">{u.display_name || 'Anonymous'}</div>
                              <div className="text-xs text-white/40">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 w-32">
                            <span className="text-xs">{formatFileSize(u.used_storage_bytes)}</span>
                            <div className="w-full bg-black/50 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${usagePercent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{formatFileSize(u.max_storage_bytes)}</td>
                        <td className="px-6 py-4 text-white/50">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          {u.is_admin ? (
                            <span className="badge-purple bg-purple-500/20 text-purple-400">Admin</span>
                          ) : (
                            <span className="badge-gray bg-white/10">User</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
