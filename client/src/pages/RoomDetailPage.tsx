import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, CalendarDays, Users, Image, UserPlus,
  Loader2, FolderOpen, Camera, Clock, Check, X, Trash2, Settings, BarChart3, Bell
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRoomStore } from '@/store/roomStore'
import { getRoomById, requestToJoinRoom, updateMemberStatus, deleteRoom } from '@/services/roomService'
import { getEventsByRoom } from '@/services/eventService'
import { CreateEventModal } from '@/components/modals/CreateEventModal'
import { InviteMemberModal } from '@/components/modals/InviteMemberModal'
import { RoomSettingsModal } from '@/components/modals/RoomSettingsModal'
import { RoomAnalyticsModal } from '@/components/modals/RoomAnalyticsModal'
import { ActivityFeedModal } from '@/components/modals/ActivityFeedModal'
import { PresenceAvatars } from '@/components/shared/PresenceAvatars'
import { usePresence } from '@/hooks/realtime/usePresence'
import { toast } from 'sonner'
import type { EventWithDetails } from '@/types'

export function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentRoom, setCurrentRoom } = useRoomStore()

  const [events, setEvents] = useState<EventWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [isRequestingJoin, setIsRequestingJoin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { onlineUsers } = usePresence(roomId || '')

  useEffect(() => {
    if (!roomId) return

    setIsLoading(true)
    Promise.all([getRoomById(roomId), getEventsByRoom(roomId)])
      .then(([roomRes, eventsData]) => {
        if (roomRes.error || !roomRes.data) {
          setError(roomRes.error ?? 'Room not found')
        } else {
          setCurrentRoom(roomRes.data)
          setEvents(eventsData)
        }
      })
      .finally(() => setIsLoading(false))
  }, [roomId, setCurrentRoom])

  const room = currentRoom

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin-slow text-[#52525b]" />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <FolderOpen size={48} className="text-[#3f3f46] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#f4f4f5] mb-2">{error ?? 'Room not found'}</h1>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary mt-4">
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  const userMember = room.members.find((m) => m.userId === user?.id)
  const isRoomMember = userMember?.status === 'approved'
  const membershipStatus = userMember?.status
  const isOwner = userMember?.role === 'owner' && isRoomMember
  const pendingMembers = isOwner ? room.members.filter(m => m.status === 'pending') : []

  // Calculate visible events for partial access
  const visibleEvents = isRoomMember
    ? events
    : events.filter(e => e.members.some(m => m.userId === user?.id && m.status === 'approved'))

  const hasAccess = isRoomMember || visibleEvents.length > 0

  const handleJoinRequest = async () => {
    if (!roomId || !user) return
    setIsRequestingJoin(true)
    const { error } = await requestToJoinRoom(roomId, user.id)
    setIsRequestingJoin(false)
    if (error) {
      setError(error)
    } else {
      toast.success('Join request sent')
      const res = await getRoomById(roomId)
      if (res.data) setCurrentRoom(res.data)
    }
  }

  const handleDeleteRoom = async () => {
    if (!room) return
    if (!window.confirm(`Are you sure you want to permanently delete the room "${room.name}"? This will delete all events and photos inside it.`)) return

    const { error } = await deleteRoom(room.id)
    if (error) {
      toast.error('Failed to delete room')
    } else {
      toast.success('Room deleted successfully')
      navigate('/dashboard')
    }
  }

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    if (!roomId) return
    const { error } = await updateMemberStatus(roomId, userId, status)
    if (!error) {
      setCurrentRoom({
        ...room,
        members: room.members.map(m => m.userId === userId ? { ...m, status } : m)
      })
    }
  }

  // Waiting Room UIs
  if (!hasAccess) {
    if (membershipStatus === 'pending') {
      return (
        <div className="max-w-xl mx-auto px-4 py-20 text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <Clock size={32} className="text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-[#f4f4f5] mb-3">Request Sent!</h1>
          <p className="text-[#a1a1aa] mb-8 text-sm max-w-sm mx-auto leading-relaxed">
            You are in the waiting room for <span className="text-white font-medium">{room.name}</span>.<br />
            The host has been notified. This page will update automatically once you are let in.
          </p>
        </div>
      )
    }

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
          <FolderOpen size={28} className="text-blue-400" />
        </div>
        <h1 className="text-xl font-bold text-[#f4f4f5] mb-2">{room.name}</h1>
        <p className="text-[#a1a1aa] mb-8 text-sm">
          You have been invited to join this room. Request access to see photos and events.
        </p>
        <button 
          onClick={handleJoinRequest} 
          disabled={isRequestingJoin}
          className="btn-primary w-full justify-center max-w-xs mx-auto py-3"
        >
          {isRequestingJoin ? <Loader2 size={18} className="animate-spin" /> : 'Request to Join'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-[#71717a] hover:text-[#a1a1aa] mb-6 transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        All Rooms
      </button>

      {/* Room Header */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] mb-8">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-violet-600/8 to-transparent" />
        <div className="absolute inset-0 bg-[#0a0a0a]/50" />

        <div className="relative p-6 sm:p-8 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <FolderOpen size={20} className="text-blue-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#f4f4f5] truncate">
                {room.name}
              </h1>
              <div className="ml-4">
                <PresenceAvatars users={onlineUsers} />
              </div>
            </div>
            {room.description && (
              <p className="text-[#a1a1aa] ml-13 text-sm">{room.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-[#71717a]">
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                {visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}
              </span>
              <span className="flex items-center gap-1.5">
                <Image size={14} />
                {visibleEvents.reduce((acc, e) => acc + e.photoCount, 0)} files
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner && (
              <>
                <button
                  onClick={handleDeleteRoom}
                  className="p-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete Room"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="btn-secondary"
                  title="Analytics"
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="btn-secondary"
                >
                  <Settings size={16} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  id="invite-member-btn"
                  onClick={() => setShowInvite(true)}
                  className="btn-secondary"
                >
                  <UserPlus size={16} />
                  Invite
                </button>
              </>
            )}
            {hasAccess && (
              <>
                <button
                  onClick={() => setShowActivity(true)}
                  className="btn-secondary"
                  title="Activity Feed"
                >
                  <Bell size={16} />
                </button>
                <button
                  id="create-event-btn"
                  onClick={() => setShowCreateEvent(true)}
                  className="btn-blue"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">New Event</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pending Requests Banner (Owner Only) */}
      {isOwner && pendingMembers.length > 0 && (
        <div className="mb-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-slide-down">
          <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <Users size={16} />
            Pending Join Requests ({pendingMembers.length})
          </h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {pendingMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-[#18181b] border border-white/[0.05]">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {(member.displayName || member.userId).slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-300 truncate">{member.displayName || `User ${member.userId.slice(0, 6)}`}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleUpdateStatus(member.userId, 'approved')} className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Admit">
                    <Check size={14} />
                  </button>
                  <button onClick={() => handleUpdateStatus(member.userId, 'rejected')} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition-colors" title="Deny">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        {visibleEvents.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            index={i}
            onClick={() => navigate(`/room/${roomId}/event/${event.id}`)}
          />
        ))}

        {hasAccess && (
          <button
            onClick={() => setShowCreateEvent(true)}
            className="rounded-2xl border-2 border-dashed border-white/[0.08] p-8 flex flex-col items-center gap-3 text-[#71717a] hover:text-[#a1a1aa] hover:border-white/[0.15] hover:bg-white/[0.02] transition-all duration-200 group h-full justify-center min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.15] transition-colors">
              <Plus size={24} />
            </div>
            <span className="text-sm font-medium">Create Event</span>
          </button>
        )}
      </div>

      {visibleEvents.length === 0 && !isRoomMember && (
        <div className="text-center py-20">
          <CalendarDays size={48} className="text-[#3f3f46] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">No events available</h3>
          <p className="text-[#a1a1aa]">You don't have access to any events in this room.</p>
        </div>
      )}

      {/* Members panel */}
      {room.members.filter(m => m.status === 'approved').length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4">Members</h2>
          <div className="flex flex-wrap gap-3">
            {room.members.filter(m => m.status === 'approved').map((member) => (
              <div key={member.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.07]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                  {member.userId.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-[#a1a1aa] capitalize">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateEventModal
        isOpen={showCreateEvent}
        roomId={roomId!}
        onClose={() => setShowCreateEvent(false)}
        onCreated={(event) => setEvents((prev) => [event as EventWithDetails, ...prev])}
      />
      <InviteMemberModal
        isOpen={showInvite}
        roomId={roomId!}
        roomName={room.name}
        onClose={() => setShowInvite(false)}
      />
      <RoomSettingsModal
        isOpen={showSettings}
        room={room}
        onClose={() => setShowSettings(false)}
        onUpdate={(updates) => setCurrentRoom({ ...room, ...updates })}
      />
      <RoomAnalyticsModal
        isOpen={showAnalytics}
        roomId={roomId!}
        onClose={() => setShowAnalytics(false)}
      />
      <ActivityFeedModal
        isOpen={showActivity}
        roomId={roomId!}
        onClose={() => setShowActivity(false)}
      />
    </div>
  )
}

// ─── Event Card ──────────────────────────────────────────────────────────────

const EVENT_GRADIENTS = [
  'from-blue-500/20 to-cyan-500/10',
  'from-violet-500/20 to-purple-500/10',
  'from-emerald-500/20 to-teal-500/10',
  'from-rose-500/20 to-pink-500/10',
  'from-amber-500/20 to-orange-500/10',
]

function EventCard({
  event, index, onClick,
}: { event: EventWithDetails; index: number; onClick: () => void }) {
  const grad = EVENT_GRADIENTS[index % EVENT_GRADIENTS.length]
  const createdDate = new Date(event.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })

  return (
    <div
      className="card-hover cursor-pointer group animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Mini preview / gradient */}
      <div 
        className={`h-20 rounded-t-xl bg-gradient-to-br ${grad} flex items-center justify-center ${event.thumbnailUrl ? 'bg-cover bg-center' : ''}`}
        style={event.thumbnailUrl ? { backgroundImage: `url(${event.thumbnailUrl})` } : undefined}
      >
        {!event.thumbnailUrl && (
          event.photoCount === 0 ? (
            <Camera size={28} className="text-white/20" />
          ) : (
            <div className="flex items-center gap-2 text-white/60">
              <Camera size={18} />
              <span className="text-sm font-medium">{event.photoCount} files</span>
            </div>
          )
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-[#f4f4f5] group-hover:text-white transition-colors truncate">
          {event.title}
        </h3>
        {event.description && (
          <p className="text-sm text-[#71717a] mt-0.5 line-clamp-1">{event.description}</p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-[#71717a]">
          <span className="flex items-center gap-1">
            <Users size={11} />
            {event.participantCount}
          </span>
          <span className="flex items-center gap-1">
            <Image size={11} />
            {event.photoCount}
          </span>
          <span className="ml-auto">{createdDate}</span>
        </div>
      </div>
    </div>
  )
}
