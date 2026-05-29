import { useState, useEffect } from 'react'
import { X, HardDrive, Image as ImageIcon, Video, Trophy } from 'lucide-react'
import { getRoomAnalytics } from '@/services/roomService'
import { formatFileSize } from '@/services/uploadService'
import { getUserProfile } from '@/services/authService'

interface RoomAnalyticsModalProps {
  isOpen: boolean
  roomId: string
  onClose: () => void
}

export function RoomAnalyticsModal({ isOpen, roomId, onClose }: RoomAnalyticsModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [contributors, setContributors] = useState<any[]>([])

  useEffect(() => {
    if (!isOpen || !roomId) return

    let mounted = true
    setIsLoading(true)

    async function fetchData() {
      const { totalSize, photoCount, videoCount, topContributors, error } = await getRoomAnalytics(roomId)
      
      if (!mounted) return
      
      if (!error) {
        setStats({ totalSize, photoCount, videoCount })
        
        // Fetch profiles for the top contributors to get avatars and names
        const enrichedContributors = await Promise.all(
          topContributors.map(async (tc) => {
            const { data } = await getUserProfile(tc.userId)
            return {
              ...tc,
              name: data?.user_metadata?.full_name || data?.email?.split('@')[0] || 'Unknown',
              avatarUrl: data?.user_metadata?.avatar_url
            }
          })
        )
        setContributors(enrichedContributors)
      }
      setIsLoading(false)
    }

    fetchData()
    return () => { mounted = false }
  }, [isOpen, roomId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-md rounded-2xl p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#f4f4f5] flex items-center gap-2">
            <HardDrive className="text-blue-400" />
            Room Analytics
          </h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin-slow" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
                <HardDrive size={24} className="text-blue-400 mb-2" />
                <span className="text-2xl font-bold text-white">{formatFileSize(stats?.totalSize || 0)}</span>
                <span className="text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Storage</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
                <ImageIcon size={24} className="text-pink-400 mb-2" />
                <span className="text-2xl font-bold text-white">{stats?.photoCount || 0}</span>
                <span className="text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Photos</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
                <Video size={24} className="text-violet-400 mb-2" />
                <span className="text-2xl font-bold text-white">{stats?.videoCount || 0}</span>
                <span className="text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Videos</span>
              </div>
            </div>

            {/* Leaderboard */}
            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f5] mb-3 flex items-center gap-2">
                <Trophy size={16} className="text-amber-400" />
                Top Contributors
              </h3>
              
              {contributors.length === 0 ? (
                <div className="text-center py-6 text-[#71717a] text-sm bg-white/[0.02] border border-white/5 rounded-xl">
                  No uploads in this room yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {contributors.map((c, idx) => (
                    <div key={c.userId} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] transition-colors">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-400/20 text-amber-400' :
                        idx === 1 ? 'bg-slate-300/20 text-slate-300' :
                        idx === 2 ? 'bg-amber-700/20 text-amber-600' :
                        'bg-white/10 text-[#a1a1aa]'
                      }`}>
                        #{idx + 1}
                      </div>
                      
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <p className="text-xs text-[#71717a]">{c.count} files • {formatFileSize(c.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
