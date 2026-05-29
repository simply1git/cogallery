import { useState, useEffect } from 'react'
import { X, Bell, Image as ImageIcon, MessageSquare, Heart } from 'lucide-react'
import { getActivityLogs, type ActivityLog } from '@/services/activityService'
import { getUserProfile } from '@/services/authService'
import { formatDistanceToNow } from 'date-fns'

interface ActivityFeedModalProps {
  isOpen: boolean
  roomId: string
  onClose: () => void
}

export function ActivityFeedModal({ isOpen, roomId, onClose }: ActivityFeedModalProps) {
  const [logs, setLogs] = useState<(ActivityLog & { userName: string, avatarUrl?: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !roomId) return

    let mounted = true
    setIsLoading(true)

    async function fetchFeed() {
      const { data, error } = await getActivityLogs(roomId)
      
      if (!mounted) return
      
      if (!error && data) {
        // Fetch profiles for users
        const enriched = await Promise.all(
          data.map(async (log) => {
            if (!log.userId) return { ...log, userName: 'Unknown User' }
            const { data: profile } = await getUserProfile(log.userId)
            return {
              ...log,
              userName: profile?.user_metadata?.full_name || profile?.email?.split('@')[0] || 'Unknown User',
              avatarUrl: profile?.user_metadata?.avatar_url
            }
          })
        )
        setLogs(enriched)
      }
      setIsLoading(false)
    }

    fetchFeed()
    return () => { mounted = false }
  }, [isOpen, roomId])

  if (!isOpen) return null

  function renderActionIcon(action: string) {
    switch (action) {
      case 'photo_uploaded': return <ImageIcon size={14} className="text-blue-400" />
      case 'comment_added': return <MessageSquare size={14} className="text-green-400" />
      case 'reaction_added': return <Heart size={14} className="text-pink-400" />
      default: return <Bell size={14} className="text-slate-400" />
    }
  }

  function renderActionText(log: any) {
    switch (log.action) {
      case 'photo_uploaded':
        return <span>uploaded a {log.details?.media_type || 'photo'}</span>
      case 'comment_added':
        return <span>commented on a photo</span>
      case 'reaction_added':
        return <span>reacted {log.details?.emoji} to a photo</span>
      default:
        return <span>performed an action</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-md rounded-2xl p-6 animate-scale-in max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold text-[#f4f4f5] flex items-center gap-2">
            <Bell className="text-blue-400" />
            Activity Feed
          </h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 pr-2 -mr-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin-slow" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-[#71717a]">
              <Bell size={32} className="mx-auto mb-3 opacity-20" />
              <p>No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 items-start">
                  <div className="shrink-0 mt-1">
                    {log.avatarUrl ? (
                      <img src={log.avatarUrl} alt={log.userName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                        {log.userName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      {renderActionIcon(log.action)}
                      <span className="text-sm font-medium text-white">{log.userName}</span>
                      <span className="text-sm text-[#a1a1aa]">{renderActionText(log)}</span>
                    </div>
                    <span className="text-xs text-[#71717a]">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
