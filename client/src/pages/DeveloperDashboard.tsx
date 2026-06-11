import { useEffect, useState } from 'react'
import { Activity, Users, Shield, Server, Terminal, HardDrive, Settings, Ban, Trash2, Edit2, Database, Network } from 'lucide-react'
import { AdminUser, TelemetryData, GlobalConfig, SupabaseDbSize, SupabaseTableCounts, StorageNode, getAllUsers, getTelemetry, getActiveStorageNodes, checkIsAdmin, updateUserQuota, toggleUserBan, nukeUser, getGlobalConfig, updateGlobalConfig, clearTempStorage, clearOldStorage, wipeAllStorage, getSupabaseDbSize, getSupabaseTableCounts, updateServerCode } from '@/services/adminService'
import { formatFileSize } from '@/services/uploadService'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { QuotaModal } from '@/components/modals/QuotaModal'

export function DeveloperDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [activeNodes, setActiveNodes] = useState<StorageNode[]>([])
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryData>>({})
  const [telemetryError, setTelemetryError] = useState<Record<string, string>>({})
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
    
    const fetchClusterState = async () => {
      try {
        const nodes = await getActiveStorageNodes()
        setActiveNodes(nodes)
        
        // Fetch telemetry for all nodes in parallel
        nodes.forEach(node => {
          getTelemetry(node.node_url)
            .then(data => { 
              setTelemetry(prev => ({ ...prev, [node.id]: data }))
              setTelemetryError(prev => ({ ...prev, [node.id]: '' }))
            })
            .catch(err => setTelemetryError(prev => ({ ...prev, [node.id]: err.message })))
        })
      } catch (err) {
        console.error("Failed to fetch active nodes", err)
      }
    }
    
    fetchClusterState()
    const interval = setInterval(fetchClusterState, 5000)
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

  const handleSyncAllCode = async () => {
    if (!confirm('Are you sure you want to pull the latest code and restart PM2 across the ENTIRE cluster?')) return
    try {
      setIsProcessing(true)
      toast.loading('Deploying to cluster...', { id: 'ota' })
      let successCount = 0
      for (const node of activeNodes) {
        try {
          await updateServerCode(node.node_url)
          successCount++
        } catch (e: any) {
          toast.error(`Failed on ${node.node_url}: ${e.message}`, { id: 'ota' })
        }
      }
      toast.success(`Successfully deployed to ${successCount} nodes.`, { id: 'ota' })
    } finally { setIsProcessing(false) }
  }

  const handleClearTemp = async () => {
    if (!confirm('Clear all abandoned temporary chunks across ALL nodes?')) return
    try {
      setIsProcessing(true)
      let totalDeleted = 0
      for (const node of activeNodes) {
        const res = await clearTempStorage(node.node_url).catch(() => ({ deletedCount: 0 }))
        totalDeleted += res.deletedCount
      }
      toast.success(`Cleared ${totalDeleted} temporary chunk folders across the cluster.`)
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleClearOld = async () => {
    if (!confirm('WARNING: This will delete files older than 30 days from ALL nodes. Continue?')) return
    try {
      setIsProcessing(true)
      let totalDeleted = 0
      for (const node of activeNodes) {
        const res = await clearOldStorage(node.node_url).catch(() => ({ deletedCount: 0 }))
        totalDeleted += res.deletedCount
      }
      toast.success(`Deleted ${totalDeleted} old files across the cluster.`)
    } catch(e: any) { toast.error(e.message) }
    finally { setIsProcessing(false) }
  }

  const handleWipeAll = async () => {
    if (!confirm('DANGER! This will delete ALL files in the main storage and temp folder on ALL nodes! Are you sure?')) return
    if (!confirm('Are you ABSOLUTELY sure? This cannot be undone!')) return
    try {
      setIsProcessing(true)
      for (const node of activeNodes) {
        await wipeAllStorage(node.node_url).catch(e => toast.error(`Wipe failed on ${node.node_url}: ${e.message}`))
      }
      toast.success('All storage files have been wiped across the cluster.')
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
            <div className="flex items-center justify-between bg-[#111] border border-white/10 rounded-xl p-6 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Network className="text-blue-400"/> Cluster Control Plane</h3>
                <p className="text-sm text-white/50 mt-1">Found {activeNodes.length} active Oracle storage nodes</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSyncAllCode} disabled={isProcessing || activeNodes.length === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2">
                  <Terminal size={16}/> Deploy to Cluster
                </button>
              </div>
            </div>

            {activeNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-[#111] border border-white/10 rounded-xl">
                <Activity className="animate-spin text-white/30" size={32} />
                <p className="text-white/50 text-sm">Discovering Oracle Nodes via Supabase Heartbeat...</p>
                <p className="text-xs text-white/30 max-w-md text-center">Ensure your backend has `NODE_URL` in its `.env` and PM2 is running. It takes up to 60 seconds to register.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {activeNodes.map((node, index) => {
                  const nodeUrl = node.node_url;
                  const error = telemetryError[node.id];
                  const data = telemetry[node.id];
                  return (
                    <div key={node.id} className="bg-black border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                      {/* Node Header */}
                      <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${data ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                          <div>
                            <div className="font-mono text-sm text-white font-bold">NODE {index + 1}</div>
                            <div className="text-xs text-white/50">{nodeUrl}</div>
                          </div>
                        </div>
                        <div className="text-xs text-white/30">Last Heartbeat: {new Date(node.last_heartbeat).toLocaleTimeString()}</div>
                      </div>

                      <div className="p-6">
                        {error ? (
                          <div className="text-center py-8">
                            <Server className="text-red-400 mx-auto mb-2" size={32} />
                            <p className="text-red-400 text-sm">Connection Failed: {error}</p>
                            <p className="text-white/30 text-xs mt-2">Ensure the Node URL is publicly accessible and not blocked by CORS.</p>
                          </div>
                        ) : !data ? (
                           <div className="flex justify-center py-8"><Activity className="animate-spin text-white/30" /></div>
                        ) : (
                          <div className="space-y-6">
                            {/* Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-[#111] border border-white/10 rounded-xl p-4">
                                <div className="text-white/50 text-xs mb-2">CPU Load</div>
                                <div className="text-xl font-mono">{data.cpuLoad[0].toFixed(2)}</div>
                              </div>
                              <div className="bg-[#111] border border-white/10 rounded-xl p-4">
                                <div className="text-white/50 text-xs mb-2">Memory ({data.memory.percent}%)</div>
                                <div className="text-xl font-mono">{formatFileSize(data.memory.used)} <span className="text-xs text-white/30">/ {formatFileSize(data.memory.total)}</span></div>
                              </div>
                              <div className="bg-[#111] border border-white/10 rounded-xl p-4">
                                <div className="text-white/50 text-xs mb-2">Disk Used ({data.disk?.percent}%)</div>
                                <div className="text-xl font-mono">{formatFileSize(data.disk?.used || 0)} <span className="text-xs text-white/30">/ {formatFileSize(data.disk?.total || 0)}</span></div>
                              </div>
                            </div>
                            
                            {/* Storage Details */}
                            {data.storage && (
                              <div className="flex gap-4">
                                <div className="flex-1 bg-[#111] border border-white/10 rounded-xl p-4 flex justify-between items-center">
                                  <div>
                                    <div className="text-xs text-blue-400">Main Storage</div>
                                    <div className="font-mono">{formatFileSize(data.storage.main.size)}</div>
                                  </div>
                                  <div className="text-xs text-white/30">{data.storage.main.count} files</div>
                                </div>
                                <div className="flex-1 bg-[#111] border border-white/10 rounded-xl p-4 flex justify-between items-center">
                                  <div>
                                    <div className="text-xs text-blue-400">Temp Chunks</div>
                                    <div className="font-mono">{formatFileSize(data.storage.temp.size)}</div>
                                  </div>
                                  <div className="text-xs text-white/30">{data.storage.temp.count} folders</div>
                                </div>
                              </div>
                            )}

                            {/* Terminal logs preview */}
                            <div className="bg-black/50 border border-white/5 rounded-lg overflow-hidden">
                              <div className="px-3 py-1 bg-white/5 text-[10px] text-white/30 font-mono">PM2 LOGS</div>
                              <pre className="p-3 text-[10px] text-[#00ff00] h-24 overflow-y-auto font-mono whitespace-pre-wrap">{data.logs}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Cluster Actions */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-xl mt-8">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HardDrive size={18} className="text-blue-400"/> Cluster-Wide Storage Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={handleClearTemp} disabled={isProcessing} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-left transition-colors">
                      <div className="flex items-center gap-2 text-white mb-1"><Trash2 size={16}/> Clear Abandoned Chunks</div>
                      <div className="text-xs text-white/40">Frees temp space on all active nodes</div>
                    </button>
                    <button onClick={handleClearOld} disabled={isProcessing} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-left transition-colors">
                      <div className="flex items-center gap-2 text-white mb-1"><Trash2 size={16}/> Clear &gt;30 Days Old</div>
                      <div className="text-xs text-white/40">Deletes old files on all active nodes</div>
                    </button>
                    <button onClick={handleWipeAll} disabled={isProcessing} className="p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-left transition-colors">
                      <div className="flex items-center gap-2 text-red-400 mb-1"><Ban size={16}/> Wipe All Storage</div>
                      <div className="text-xs text-red-400/50">DANGER: Wipes all media across cluster</div>
                    </button>
                  </div>
                </div>
              </div>
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
