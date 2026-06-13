import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Image, Video, Users, UserPlus, Settings, Trash2, CheckSquare, RefreshCw, UploadCloud } from 'lucide-react'
import { PresenceAvatars } from '@/components/shared/PresenceAvatars'
import { formatFileSize } from '@/services/uploadService'
import type { EventWithDetails, RoomWithMembers } from '@/types'
import { useAuth } from '@/hooks/useAuth'

interface EventHeaderProps {
  event: EventWithDetails
  room: RoomWithMembers | null
  roomId: string | undefined
  imageCount: number
  videoCount: number
  totalSize: number
  onlineUsers: any[]
  canManageEvent: boolean
  isEventOwner: boolean
  isSelectionMode: boolean
  showUpload: boolean
  onToggleSelectionMode: () => void
  onRefresh: () => void
  onToggleUpload: () => void
  onShowInvite: () => void
  onShowSettings: () => void
  onDeleteEvent: () => void
}

export function EventHeader({
  event,
  room,
  roomId,
  imageCount,
  videoCount,
  totalSize,
  onlineUsers,
  canManageEvent,
  isEventOwner,
  isSelectionMode,
  showUpload,
  onToggleSelectionMode,
  onRefresh,
  onToggleUpload,
  onShowInvite,
  onShowSettings,
  onDeleteEvent
}: EventHeaderProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <>
      {/* Breadcrumb */}
      {room && (
        <button
          onClick={() => navigate(`/room/${roomId}`)}
          className="flex items-center gap-2 text-[#71717a] hover:text-[#a1a1aa] mb-6 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Room
        </button>
      )}

      {/* Event Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#f4f4f5]">{event.title}</h1>
            <PresenceAvatars users={onlineUsers} />
          </div>
          {event.description && (
            <p className="text-[#a1a1aa]">{event.description}</p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[#71717a]">
            <span className="flex items-center gap-1.5">
              <Image size={14} className="text-blue-400" />
              {imageCount} photos
            </span>
            <span className="flex items-center gap-1.5">
              <Video size={14} className="text-purple-400" />
              {videoCount} videos
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {event.participantCount} participants
            </span>
            {totalSize > 0 && (
              <span className="text-[#52525b]">
                {formatFileSize(totalSize)} total
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto pb-1 -mb-1">
          {canManageEvent && (
            <button
              onClick={onShowInvite}
              className="btn-secondary"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {isEventOwner && (
            <>
              <button
                onClick={onShowSettings}
                className="btn-secondary"
              >
                <Settings size={16} />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={onDeleteEvent}
                className="p-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete Event"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}

          <button
            onClick={onToggleSelectionMode}
            className={isSelectionMode ? 'btn-blue' : 'btn-secondary'}
          >
            <CheckSquare size={16} />
            <span className="hidden sm:inline">{isSelectionMode ? 'Done' : 'Select'}</span>
          </button>
          
          <button
            onClick={onRefresh}
            className="btn-icon"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          {user && !isSelectionMode && (
            <button
              id="toggle-upload-btn"
              onClick={onToggleUpload}
              className={showUpload ? 'btn-secondary' : 'btn-blue'}
            >
              <UploadCloud size={16} />
              {showUpload ? 'Hide Upload' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
