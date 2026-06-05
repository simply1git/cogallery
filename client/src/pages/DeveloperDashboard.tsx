import { useEffect, useState } from 'react'
import { Activity, Users, Shield, Server, Terminal, HardDrive, Settings, Ban, Trash2, Edit2, Database, Network } from 'lucide-react'
import { AdminUser, TelemetryData, GlobalConfig, SupabaseDbSize, SupabaseTableCounts, getAllUsers, getTelemetry, checkIsAdmin, updateUserQuota, toggleUserBan, nukeUser, getGlobalConfig, updateGlobalConfig, clearTempStorage, clearOldStorage, wipeAllStorage, downloadBackup, getSupabaseDbSize, getSupabaseTableCounts } from '@/services/adminService'
import { formatFileSize } from '@/services/uploadService'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { QuotaModal } from '@/components/modals/QuotaModal'

export function DeveloperDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null)
  const [telemetryError, setTelemetryError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'server' | 'supabase' | 'settings'>('server')
  const [dbSize, setDbSize] = useState<SupabaseDbSize | null>(null)
  const [tableCounts, setTableCounts] = useState<SupabaseTableCounts | null>(null)
  const navigate = useNavigate()
  const [isProcessing, setIsProcessing] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
  const [quotaModalUser, setQuotaModalUser] = useState<AdminUser | null>(null)

  const refreshUsers = () => getAllUsers().then(setUsers).catch(err => toast.error(err.message))
  const refreshConfig = () => getGlobalConfig().then(setGlobalConfig).catch(console.error)

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
    if (activeTab === 'users') refreshUsers()
    if (activeTab === 'settings') refreshConfig()
    if (activeTab === 'supabase') {
      getSupabaseDbSize().then(setDbSize)
      getSupabaseTableCounts().then(setTableCounts)
    }
  }, [isAdmin, activeTab])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'server') return
    // Poll telemetry every 5 seconds
    const fetchTelemetry = () => {
      getTelemetry()
        .then(data => { setTelemetry(data); setTelemetryError(null); })
        .catch(err => setTelemetryError(err.message))
    }
    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 5000)
    return () => clearInterval(interval)
  }, [isAdmin, activeTab])

  if (isAdmin === null) return <div className="p-8 flex justify-center"><Activity className="animate-spin" /></div>
  if (!isAdmin) return null

  const handleQuotaChange = (u: AdminUser) => {
    setQuotaModalUser(u)
  }

  const handleSaveQuota = async (bytes: number) => {
    if (!quotaModalUser) return
    try {
      setIsProcessing(true)
      await updateUserQuota(quotaModalUser.id, bytes)
      toast.success('Quota updated')
      setQuotaModalUser(null)
      refreshUsers()
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleToggleBan = async (u: AdminUser) => {
    const isBanned = u.account_status === 'banned'
    const verb = isBanned ? 'Unban' : 'Ban'
    if (!confirm(`Are you sure you want to ${verb} ${u.display_name}?`)) return
    try {
      setIsProcessing(true)
      await toggleUserBan(u.id, !isBanned)
      toast.success(`${verb} successful`)
      refreshUsers()
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleNukeUser = async (u: AdminUser) => {
    if (!confirm(`⚡ WARNING ⚡\nAre you sure you want to PERMANENTLY NUKE ${u.display_name}?\n\nThis will physically delete all their photos from the Cloudflare R2 bucket and wipe their database records. This cannot be undone.`)) return
    try {
      setIsProcessing(true)
      toast.loading('Vacuuming R2 bucket...', { id: 'nuke' })
      const res = await nukeUser(u.id)
      toast.success(`User nuked. Deleted ${res.deletedFiles} files from R2.`, { id: 'nuke' })
      refreshUsers()
    } catch(e: any) { toast.error(e.message, { id: 'nuke' }) }
    finally { setIsProcessing(false) }
  }

  const handleBackup = async () => {
    try {
      setIsProcessing(true)
      toast.loading('Preparing backup zip...', { id: 'backup' })
      await downloadBackup()
      toast.success('Backup downloaded successfully.', { id: 'backup' })
    } catch(e: any) { toast.error(e.message, { id: 'backup' }) }
    finally { setIsProcessing(false) }
  }

  const handleClearTemp = async () => {
    if (!confirm('Clear all abandoned temporary chunks?')) return
    try {
      setIsProcessing(true)
      const res = await clearTempStorage()
      toast.success(`Cleared ${res.deletedCount} temporary chunk folders.`)
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleClearOld = async () => {
    if (!confirm('WARNING: This will delete files older than 30 days from the main storage folder. Continue?')) return
    try {
      setIsProcessing(true)
      const res = await clearOldStorage()
      toast.success(`Deleted ${res.deletedCount} old files.`)
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleWipeAll = async () => {
    if (!confirm('DANGER! This will delete ALL files in the main storage and temp folder! Are you sure?')) return
    if (!confirm('Are you ABSOLUTELY sure? This cannot be undone!')) return
    try {
      setIsProcessing(true)
      await wipeAllStorage()
      toast.success('All storage files have been wiped.')
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleToggleMaintenance = async () => {
    if (!globalConfig) return
    try {
      setIsProcessing(true)
      await updateGlobalConfig(!globalConfig.maintenance_mode, globalConfig.signups_disabled, globalConfig.read_only_mode)
      toast.success('Maintenance mode toggled. Realtime clients updated.')
      refreshConfig()
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleToggleSignups = async () => {
    if (!globalConfig) return
    try {
      setIsProcessing(true)
      await updateGlobalConfig(globalConfig.maintenance_mode, !globalConfig.signups_disabled, globalConfig.read_only_mode)
      toast.success('Signups toggled.')
      refreshConfig()
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

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
          <button
            onClick={() => setActiveTab('supabase')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'supabase' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Database size={16} /> Supabase Stats
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'settings' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
            }`}
          >
            <Settings size={16} /> Global Config
          </button>
        </div>

        {/* Content */}
        {activeTab === 'server' && (
          <div className="space-y-6 animate-fade-in">
            {telemetryError ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                <Server className="text-red-400" size={48} />
                <div>
                  <h3 className="text-lg font-bold text-red-400">Failed to Connect to Oracle Server</h3>
                  <p className="text-white/50 text-sm mt-1">{telemetryError}</p>
                </div>
                <p className="text-xs text-white/30">Ensure the PM2 backend process is running on your VPS.</p>
              </div>
            ) : !telemetry ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Activity className="animate-spin text-white/30" size={32} />
                <p className="text-white/50 text-sm">Connecting to Oracle Server...</p>
              </div>
            ) : (
              <>
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

            {/* Storage Management */}
            {telemetry.storage && telemetry.disk && (
              <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 font-semibold mb-4 border-b border-white/10 pb-4">
                  <HardDrive size={18} className="text-blue-400" />
                  Disk & Local Storage Management
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Stats */}
                  <div className="space-y-4">
                    <div className="bg-black/40 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Disk Used:</span>
                        <span className="font-mono">{formatFileSize(telemetry.disk.used)} / {formatFileSize(telemetry.disk.total)}</span>
                      </div>
                      
                      {/* Advanced Disk Breakdown */}
                      <div className="w-full h-3 rounded-full flex overflow-hidden bg-black/50 border border-white/10">
                        {/* OS / System Data (Calculated as Total Used - App Data) */}
                        <div 
                          className="bg-gray-500/80 transition-all group relative cursor-help" 
                          style={{ width: `${Math.max(0, ((telemetry.disk.used - telemetry.storage.main.size - telemetry.storage.temp.size) / telemetry.disk.total) * 100)}%` }}
                          title="OS & System Software"
                        />
                        {/* Platform Developer Data */}
                        <div 
                          className="bg-blue-500 transition-all group relative cursor-help" 
                          style={{ width: `${Math.max(0, ((telemetry.storage.main.size + telemetry.storage.temp.size) / telemetry.disk.total) * 100)}%` }}
                          title="Platform Developer Data"
                        />
                      </div>
                      
                      {/* Legend */}
                      <div className="flex justify-between text-xs pt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-500/80" />
                          <span className="text-white/50">OS & System <span className="font-mono">({formatFileSize(telemetry.disk.used - telemetry.storage.main.size - telemetry.storage.temp.size)})</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-white/50">App Data <span className="font-mono">({formatFileSize(telemetry.storage.main.size + telemetry.storage.temp.size)})</span></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
                        <div className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"/> Main Storage
                        </div>
                        <div className="text-lg font-mono text-white">{formatFileSize(telemetry.storage.main.size)}</div>
                        <div className="text-xs text-white/30">{telemetry.storage.main.count} files</div>
                      </div>
                      <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
                        <div className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"/> Temp / Chunks
                        </div>
                        <div className="text-lg font-mono text-white">{formatFileSize(telemetry.storage.temp.size)}</div>
                        <div className="text-xs text-white/30">{telemetry.storage.temp.count} folders</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleBackup} disabled={isProcessing} className="w-full flex items-center justify-between p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-sm transition-colors text-left disabled:opacity-50">
                      <div className="flex items-center gap-2"><Shield size={16}/> Download Full Backup (ZIP)</div>
                    </button>
                    
                    <button onClick={handleClearTemp} disabled={isProcessing} className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors text-left disabled:opacity-50">
                      <div className="flex items-center gap-2"><Trash2 size={16}/> Clear Abandoned Chunks</div>
                      <span className="text-xs text-white/30">Frees temp space</span>
                    </button>
                    
                    <button onClick={handleClearOld} disabled={isProcessing} className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors text-left disabled:opacity-50">
                      <div className="flex items-center gap-2"><Trash2 size={16}/> Clear &gt;30 Days Old Files</div>
                      <span className="text-xs text-white/30">Deletes old files</span>
                    </button>

                    <button onClick={handleWipeAll} disabled={isProcessing} className="w-full flex items-center justify-between p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm transition-colors text-left mt-2 disabled:opacity-50">
                      <div className="flex items-center gap-2"><Ban size={16}/> Wipe All Storage</div>
                      <span className="text-xs text-red-400/50">DANGER</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Terminal */}
            <div className="bg-black border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2 text-xs font-mono text-white/50">
                <Terminal size={14} /> Live PM2 Logs (cogallery-seedbox)
              </div>
              <pre className="p-4 text-xs font-mono text-[#00ff00] h-[400px] overflow-y-auto whitespace-pre-wrap">
                {telemetry.logs}
              </pre>
            </div>
              </>
            )}
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
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.map(u => {
                    const usagePercent = u.max_storage_bytes ? (u.used_storage_bytes / u.max_storage_bytes) * 100 : 0
                    const isBanned = u.account_status === 'banned'
                    return (
                      <tr key={u.id} className={`hover:bg-white/[0.02] ${isBanned ? 'opacity-50' : ''}`}>
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
                          ) : isBanned ? (
                            <span className="badge-red bg-red-500/20 text-red-400">Banned</span>
                          ) : (
                            <span className="badge-gray bg-white/10">Active</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleQuotaChange(u)} disabled={isProcessing} className="btn-icon p-2 border border-white/10 hover:bg-white/10"><Edit2 size={14}/></button>
                            <button onClick={() => handleToggleBan(u)} disabled={isProcessing} className="btn-icon p-2 border border-white/10 hover:bg-white/10">
                              {isBanned ? <Activity size={14} className="text-green-400"/> : <Ban size={14} className="text-orange-400"/>}
                            </button>
                            {!u.is_admin && (
                              <button onClick={() => handleNukeUser(u)} disabled={isProcessing} className="btn-icon p-2 border border-red-500/50 hover:bg-red-500/20 text-red-400">
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'supabase' && (
          <div className="space-y-6 animate-fade-in">
            {/* System Architecture Map */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-6 overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 text-white/80 font-semibold mb-6">
                <Network size={18} className="text-green-400" />
                Live System Architecture Map
              </div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-black/40 rounded-xl border border-white/5">
                <div className="flex-1 text-center space-y-2 p-4 bg-white/[0.02] rounded-lg border border-white/10">
                  <div className="mx-auto w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mb-2">
                    <Activity className="text-blue-400" size={20}/>
                  </div>
                  <div className="font-semibold text-white">Frontend</div>
                  <div className="text-xs text-white/50">Cloudflare Pages</div>
                  <div className="text-[10px] text-white/30 uppercase">Static UI Assets</div>
                </div>
                
                <div className="hidden md:flex text-white/30">
                  <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500/50 to-purple-500/50 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-y-4 border-l-4 border-y-transparent border-l-purple-500/50" />
                  </div>
                </div>

                <div className="flex-1 text-center space-y-2 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <div className="mx-auto w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center mb-2">
                    <Server className="text-purple-400" size={20}/>
                  </div>
                  <div className="font-semibold text-white">Media Router</div>
                  <div className="text-xs text-purple-400/80">Oracle VPS</div>
                  <div className="text-[10px] text-white/30 uppercase">Images, Video Chunks</div>
                </div>

                <div className="hidden md:flex text-white/30">
                  <div className="h-0.5 w-16 bg-gradient-to-r from-purple-500/50 to-green-500/50 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-y-4 border-l-4 border-y-transparent border-l-green-500/50" />
                  </div>
                </div>

                <div className="flex-1 text-center space-y-2 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="mx-auto w-10 h-10 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center mb-2">
                    <Database className="text-green-400" size={20}/>
                  </div>
                  <div className="font-semibold text-white">Database & Auth</div>
                  <div className="text-xs text-green-400/80">Supabase Platform</div>
                  <div className="text-[10px] text-white/30 uppercase">User Metadata, Access Control</div>
                </div>
              </div>
            </div>

            {/* Supabase Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-white/80 font-semibold border-b border-white/10 pb-4">
                  <Database size={18} className="text-green-400" />
                  Database Physical Size
                </div>
                {dbSize ? (
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-black/40 rounded-xl border border-white/5">
                      <div className="text-sm text-white/50 mb-2">Total Database Size on Disk</div>
                      <div className="text-4xl font-mono text-green-400">{dbSize.size_pretty}</div>
                      <div className="text-xs text-white/30 mt-2">({dbSize.size_bytes.toLocaleString()} bytes)</div>
                    </div>
                    <div className="text-xs text-white/40 text-center bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-blue-300">
                      This represents the raw PostgreSQL database size. The media files themselves are stored on the Oracle server and are not included in this number.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/50 flex flex-col items-center justify-center p-8 space-y-4">
                    <Activity className="animate-spin text-white/20" size={24} />
                    <p>Loading database size (requires SQL RPC to be deployed)</p>
                  </div>
                )}
              </div>

              <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-white/80 font-semibold border-b border-white/10 pb-4">
                  <Users size={18} className="text-blue-400" />
                  Platform Record Counts
                </div>
                {tableCounts ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-xs text-white/50 mb-1">Users / Profiles</div>
                      <div className="text-xl font-mono text-white">{tableCounts.users.toLocaleString()}</div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-xs text-white/50 mb-1">Rooms</div>
                      <div className="text-xl font-mono text-white">{tableCounts.rooms.toLocaleString()}</div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-xs text-white/50 mb-1">Events</div>
                      <div className="text-xl font-mono text-white">{tableCounts.events.toLocaleString()}</div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-xs text-white/50 mb-1">Photos Indexed</div>
                      <div className="text-xl font-mono text-white">{tableCounts.photos.toLocaleString()}</div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-xs text-white/50 mb-1">Comments</div>
                      <div className="text-xl font-mono text-white">{tableCounts.comments.toLocaleString()}</div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                      <div className="text-xs text-white/50 mb-1">Reactions</div>
                      <div className="text-xl font-mono text-white">{tableCounts.reactions.toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/50 flex flex-col items-center justify-center p-8 space-y-4">
                    <Activity className="animate-spin text-white/20" size={24} />
                    <p>Loading table counts...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && globalConfig && (
          <div className="bg-[#111] border border-red-500/30 rounded-xl overflow-hidden animate-fade-in p-6 space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Global Panic Switches</h3>
              <p className="text-white/50 text-sm">These switches broadcast directly to all connected users via Supabase Realtime.</p>
            </div>
            
            <div className="space-y-4 max-w-lg">
              <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg bg-black/50">
                <div>
                  <h4 className="font-medium text-white">Maintenance Mode</h4>
                  <p className="text-xs text-white/50">Instantly redirects all users to a maintenance screen.</p>
                </div>
                <button 
                  onClick={handleToggleMaintenance} 
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${globalConfig.maintenance_mode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {globalConfig.maintenance_mode ? 'ON (Site Offline)' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg bg-black/50">
                <div>
                  <h4 className="font-medium text-white">Disable Signups</h4>
                  <p className="text-xs text-white/50">Removes the registration form from the auth page.</p>
                </div>
                <button 
                  onClick={handleToggleSignups} 
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${globalConfig.signups_disabled ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {globalConfig.signups_disabled ? 'ON (Signups Closed)' : 'OFF'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {quotaModalUser && (
        <QuotaModal
          isOpen={true}
          currentBytes={quotaModalUser.max_storage_bytes}
          userName={quotaModalUser.display_name}
          onClose={() => setQuotaModalUser(null)}
          onSave={handleSaveQuota}
        />
      )}
    </div>
  )
}
