import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Users, CalendarDays, Image, Archive } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRoomStore } from '@/store/roomStore'
import { getRoomsByUser } from '@/services/roomService'
import { CreateRoomModal } from '@/components/modals/CreateRoomModal'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { RoomWithMembers } from '@/types'

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { rooms, setRooms, isLoading, setLoading } = useRoomStore()
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getRoomsByUser(user.id).then((data) => {
      setRooms(data)
      setLoading(false)
    })
  }, [user, setRooms, setLoading])

  const activeRooms = rooms.filter((r) => !r.isArchived)
  const archivedRooms = rooms.filter((r) => r.isArchived)
  const displayRooms = showArchived ? archivedRooms : activeRooms

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#f4f4f5]">
            {user?.displayName ? `${user.displayName}'s Rooms` : 'My Rooms'}
          </h1>
          <p className="text-[#71717a] mt-1">
            {activeRooms.length} active {activeRooms.length === 1 ? 'room' : 'rooms'}
            {archivedRooms.length > 0 && ` · ${archivedRooms.length} archived`}
          </p>
        </div>
        <button
          id="create-room-btn"
          onClick={() => setShowCreateRoom(true)}
          className="btn-blue"
        >
          <Plus size={18} />
          New Room
        </button>
      </div>

      {/* Archive toggle */}
      {archivedRooms.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setShowArchived(false)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              !showArchived ? 'bg-white/10 text-[#f4f4f5]' : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              showArchived ? 'bg-white/10 text-[#f4f4f5]' : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            Archived
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayRooms.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title={showArchived ? 'No archived rooms' : 'No rooms yet'}
          description={
            showArchived
              ? 'Archived rooms will appear here.'
              : 'Create your first room to start organizing photos and videos from your trips and events.'
          }
          action={
            !showArchived ? (
              <button onClick={() => setShowCreateRoom(true)} className="btn-blue">
                <Plus size={18} />
                Create First Room
              </button>
            ) : undefined
          }
        />
      )}

      {/* Rooms grid */}
      {!isLoading && displayRooms.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayRooms.map((room, i) => (
            <RoomCard
              key={room.id}
              room={room}
              index={i}
              onClick={() => navigate(`/room/${room.id}`)}
            />
          ))}

          {/* Create room card */}
          {!showArchived && (
            <button
              onClick={() => setShowCreateRoom(true)}
              className="rounded-xl border-2 border-dashed border-white/[0.08] p-8 flex flex-col items-center gap-3 text-[#71717a] hover:text-[#a1a1aa] hover:border-white/[0.15] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.15] transition-colors">
                <Plus size={22} />
              </div>
              <span className="text-sm font-medium">Create Room</span>
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        onCreated={(roomId) => navigate(`/room/${roomId}`)}
      />
    </div>
  )
}

// ─── Room Card ───────────────────────────────────────────────────────────────

const ROOM_COLORS = [
  'from-blue-600/30 to-violet-600/20',
  'from-emerald-600/25 to-teal-600/15',
  'from-rose-600/25 to-pink-600/15',
  'from-amber-600/25 to-orange-600/15',
  'from-violet-600/30 to-purple-600/20',
  'from-cyan-600/25 to-blue-600/15',
]

function RoomCard({ room, index, onClick }: { room: RoomWithMembers; index: number; onClick: () => void }) {
  const gradient = ROOM_COLORS[index % ROOM_COLORS.length]
  const createdDate = new Date(room.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      className="card-glow cursor-pointer group animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onClick}
    >
      {/* Cover gradient or thumbnail */}
      <div 
        className={`h-28 rounded-t-xl bg-gradient-to-br ${gradient} relative overflow-hidden ${room.thumbnailUrl ? 'bg-cover bg-center' : ''}`}
        style={room.thumbnailUrl ? { backgroundImage: `url(${room.thumbnailUrl})` } : undefined}
      >
        {!room.thumbnailUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <FolderOpen size={64} />
          </div>
        )}
        {room.isArchived && (
          <div className="absolute top-2 right-2">
            <span className="badge badge-amber">
              <Archive size={10} />
              Archived
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#f4f4f5] text-base truncate group-hover:text-white transition-colors">
              {room.name}
            </h3>
            {room.description && (
              <p className="text-sm text-[#71717a] mt-0.5 line-clamp-1">{room.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-sm text-[#71717a]">
          <span className="flex items-center gap-1">
            <Users size={13} />
            {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
          </span>
          {room.eventCount > 0 && (
            <>
              <span className="text-[#3f3f46]">·</span>
              <span className="flex items-center gap-1">
                <CalendarDays size={13} />
                {room.eventCount} events
              </span>
            </>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-xs text-[#52525b]">{createdDate}</span>
          <span className="text-xs text-[#52525b] flex items-center gap-1">
            <Image size={11} />
            {room.photoCount > 0 ? `${room.photoCount} files` : 'No uploads yet'}
          </span>
        </div>
      </div>
    </div>
  )
}
