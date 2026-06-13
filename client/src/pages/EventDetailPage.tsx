import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Image, Video, Users,
  Loader2, Camera, RefreshCw, UploadCloud,
  CheckSquare, X, Download, Trash2,
  CalendarDays, UserPlus, Check, Settings, PenTool
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getEventById, requestToJoinEvent, updateEventMemberStatus, deleteEvent, updateEventThumbnail, getEventUploaders } from '@/services/eventService'
import { getRoomById, updateRoomThumbnail } from '@/services/roomService'
import { listPhotos, deletePhotoById, getSecureMediaUrl } from '@/services/photoService'
import { getUserProfile } from '@/services/authService'
import { usePhotoSubscription } from '@/hooks/realtime/usePhotoSubscription'
import { startSeeding } from '@/services/p2pService'
import { PhotoGrid } from '@/components/gallery/PhotoGrid'
import { PhotoDetailModal } from '@/components/gallery/PhotoDetailModal'
import { UploadZone } from '@/components/gallery/UploadZone'
import { PresenceAvatars } from '@/components/shared/PresenceAvatars'
import { usePresence } from '@/hooks/realtime/usePresence'
import { InviteMemberModal } from '@/components/modals/InviteMemberModal'
import { EventSettingsModal } from '@/components/modals/EventSettingsModal'
import { LiveNotes } from '@/components/events/LiveNotes'
import { PageHeaderSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { EventWithDetails, Photo, RoomWithMembers } from '@/types'
import { formatFileSize } from '@/services/uploadService'
import { downloadFilesAsZip } from '@/services/downloadService'
import { downloadFile } from '@/utils/download'
import { toast } from 'sonner'

// Lazy-load the heavy Canvas component (tldraw is ~400KB)
const MoodboardCanvas = lazy(() => 
  import('@/components/canvas/MoodboardCanvas')
    .then(m => ({ default: m.MoodboardCanvas }))
    .catch((error) => {
      // If the chunk fails to load (e.g. after a new deployment deleted the old hash),
      // force a hard refresh to get the latest index.html from the server.
      console.warn('Failed to load Canvas chunk. A new version may have been deployed. Refreshing page...', error)
      window.location.reload()
      return { default: () => <div className="text-center py-10 text-zinc-500">Loading new version...</div> }
    })
)

export function EventDetailPage() {
  const { roomId, eventId } = useParams<{ roomId: string; eventId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomWithMembers | null>(null)
  const [event, setEvent] = useState<EventWithDetails | null>(null)
  const [eventError, setEventError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isLoadingEvent, setIsLoadingEvent] = useState(true)
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isRequestingJoin, setIsRequestingJoin] = useState(false)
  const [newPhotoCount, setNewPhotoCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [uploaderFilter, setUploaderFilter] = useState<string>('all')
  const [uploadersList, setUploadersList] = useState<{id: string, name: string}[]>([])
  const [activeTab, setActiveTab] = useState<'gallery' | 'notes' | 'canvas'>('gallery')

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Presence
  const { onlineUsers } = usePresence(roomId || '', eventId || '')

  // Load event and room
  useEffect(() => {
    if (!eventId || !roomId) return
    setIsLoadingEvent(true)
    Promise.all([getEventById(eventId), getRoomById(roomId)]).then(([eventRes, roomRes]) => {
      if (eventRes.error || !eventRes.data) {
        console.error('Failed to load event:', eventRes.error)
        setEventError(eventRes.error || 'Event not found')
        // Don't immediately redirect — show an error state instead
        // The error may be RLS-related, not a true 404
        toast.error(eventRes.error || 'Could not load event')
      } else {
        setEvent(eventRes.data)
      }
      // If roomRes fails due to RLS, it's fine, the user is not a room member
      setRoom(roomRes.data || null)
      setIsLoadingEvent(false)
    })

    // Fetch uploaders for filtering
    async function fetchUploaders() {
      const { data } = await getEventUploaders(eventId!)
      if (data && data.length > 0) {
        const enriched = await Promise.all(
          data.map(async (u) => {
            const { data: profile } = await getUserProfile(u as unknown as string)
            return { 
              id: u as unknown as string, 
              name: profile?.user_metadata?.full_name || profile?.email?.split('@')[0] || 'Unknown User' 
            }
          })
        )
        setUploadersList(enriched)
      }
    }
    fetchUploaders()
    
    // Start P2P seeding if the user is authenticated
    let stopSeeding: (() => void) | undefined
    if (user?.id) {
      stopSeeding = startSeeding(eventId, user.id)
    }

    return () => {
      stopSeeding?.()
    }
  }, [eventId, roomId, user?.id])

  // Load photos
  const loadPhotos = useCallback(async () => {
    if (!eventId) return
    setIsLoadingPhotos(true)
    const { data } = await listPhotos({
      eventId,
      mediaType: filter === 'all' ? undefined : filter,
      uploaderId: uploaderFilter === 'all' ? undefined : uploaderFilter,
      pageSize: 200,
    })
    setPhotos(data)
    setIsLoadingPhotos(false)
    setNewPhotoCount(0)
  }, [eventId, filter, uploaderFilter])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  // Real-time subscription
  usePhotoSubscription({
    eventId: eventId!,
    onNewPhoto: (photo) => {
      // Only show banner if upload wasn't by current user
      if (photo.uploaderId !== user?.id && photo.s3Url !== 'https://pending') {
        setNewPhotoCount((c) => c + 1)
      }
      setPhotos((prev) => {
        const existing = prev.find((p) => p.id === photo.id)
        if (existing) {
          // Replace with updated photo
          return prev.map(p => p.id === photo.id ? photo : p)
        }
        return [photo, ...prev]
      })
    },
    onPhotoDeleted: (photoId) => {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      if (selectedPhoto?.id === photoId) setSelectedPhoto(null)
    },
  })

  // Upload success handler
  function handleUploadSuccess(photo: Photo) {
    setPhotos((prev) => {
      const existing = prev.find((p) => p.id === photo.id)
      if (existing) {
        return prev.map(p => p.id === photo.id ? photo : p)
      }
      return [photo, ...prev]
    })
    setEvent((prev) => prev ? { ...prev, photoCount: prev.photoCount + 1 } : prev)
  }

  async function handleDeletePhoto(photo: Photo) {
    const { error } = await deletePhotoById(photo.id, photo.s3Key!)
    if (error) { toast.error(error); return }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    toast.success('Deleted')
  }

  const handleDeleteEvent = async () => {
    if (!event) return
    if (!window.confirm(`Are you sure you want to permanently delete the event "${event.title}"? This will delete all photos inside it.`)) return

    const { error } = await deleteEvent(event.id)
    if (error) {
      toast.error('Failed to delete event')
    } else {
      toast.success('Event deleted successfully')
      navigate(`/room/${roomId}`)
    }
  }

  const canDeletePhoto = useCallback((photo: Photo) => photo.uploaderId === user?.id, [user?.id])

  // Selection mode handlers
  const handleToggleSelect = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }, [])

  const handleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)))
    }
  }

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return
    setIsDownloadingZip(true)
    setDownloadProgress(0)

    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    const result = await downloadFilesAsZip(
      selectedPhotos, 
      `${event?.title || 'Event'}_Export`,
      (prog) => setDownloadProgress(prog)
    )

    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Downloaded successfully!')
      setIsSelectionMode(false)
      setSelectedIds(new Set())
    }
    
    setIsDownloadingZip(false)
  }

  const handleBatchIndividualDownload = async () => {
    if (selectedIds.size === 0) return
    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    
    // Download them individually sequentially to not crash the browser
    for (const p of selectedPhotos) {
      if (p.s3Url) {
         let targetUrl = p.s3Url;
         if (!p.isEncrypted) {
            try { targetUrl = await getSecureMediaUrl(p) } catch (e) {}
         }
         await downloadFile(targetUrl, p.filename)
      }
      // Small pause between downloads to allow the browser to process
      await new Promise(res => setTimeout(res, 300))
    }
    
    toast.success(`Started download of ${selectedPhotos.length} files`)
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) return

    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    let deletedCount = 0
    let errCount = 0

    // Can only delete own photos
    const toDelete = selectedPhotos.filter(p => p.uploaderId === user?.id)
    
    if (toDelete.length !== selectedPhotos.length) {
      toast.error('You can only delete your own photos.')
    }

    for (const photo of toDelete) {
      const { error } = await deletePhotoById(photo.id, photo.s3Key!)
      if (error) errCount++
      else deletedCount++
    }

    if (deletedCount > 0) {
      setPhotos(prev => prev.filter(p => !toDelete.find(d => d.id === p.id)))
      toast.success(`Deleted ${deletedCount} items`)
    }
    if (errCount > 0) toast.error(`Failed to delete ${errCount} items`)
    
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }

  // Stats
  const imageCount = photos.filter((p) => p.mediaType === 'image').length
  const videoCount = photos.filter((p) => p.mediaType === 'video').length
  const totalSize = photos.reduce((acc, p) => acc + (p.fileSizeBytes || 0), 0)

  // Membership & Access Logic
  const roomMember = room?.members.find((m) => m.userId === user?.id)
  const isRoomMember = roomMember?.status === 'approved'
  const isRoomOwner = roomMember?.role === 'owner' && isRoomMember

  const eventMember = event?.members.find((m) => m.userId === user?.id)
  const isEventMember = eventMember?.status === 'approved'
  const isEventOwner = eventMember?.role === 'owner' && isEventMember
  const eventMembershipStatus = eventMember?.status

  // User has access if they are an approved room member OR an approved event member
  const hasAccess = isRoomMember || isEventMember
  // User can manage invites if they are a room owner or an event owner
  const canManageEvent = isRoomOwner || isEventOwner
  const pendingMembers = canManageEvent && event ? event.members.filter(m => m.status === 'pending') : []

  const handleJoinRequest = async () => {
    if (!eventId || !user) return
    setIsRequestingJoin(true)
    const { error } = await requestToJoinEvent(eventId, user.id)
    setIsRequestingJoin(false)
    if (error) {
      toast.error(error)
    } else {
      const res = await getEventById(eventId)
      if (res.data) setEvent(res.data)
    }
  }

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    if (!eventId) return
    const { error } = await updateEventMemberStatus(eventId, userId, status)
    if (!error && event) {
      setEvent({
        ...event,
        members: event.members.map(m => m.userId === userId ? { ...m, status } : m)
      })
    }
  }

  if (isLoadingEvent) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageHeaderSkeleton />
      </div>
    )
  }

  if (eventError || !event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <CalendarDays size={28} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-[#f4f4f5] mb-2">Event Not Found</h1>
        <p className="text-[#a1a1aa] mb-6 text-sm max-w-sm mx-auto">
          This event may not exist, or you don't have permission to view it.
          If you were given a link, ask the event owner to invite you.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Go to Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    )
  }



  // Waiting Room UIs
  if (!hasAccess) {
    if (eventMembershipStatus === 'pending') {
      return (
        <div className="max-w-xl mx-auto px-4 py-20 text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <Camera size={32} className="text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-[#f4f4f5] mb-3">Request Sent!</h1>
          <p className="text-[#a1a1aa] mb-8 text-sm max-w-sm mx-auto leading-relaxed">
            You are in the waiting room for event <span className="text-white font-medium">{event.title}</span>.<br />
            The host has been notified. This page will update automatically once you are let in.
          </p>
        </div>
      )
    }

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
          <CalendarDays size={28} className="text-blue-400" />
        </div>
        <h1 className="text-xl font-bold text-[#f4f4f5] mb-2">{event.title}</h1>
        <p className="text-[#a1a1aa] mb-8 text-sm">
          You have been invited to join this event. Request access to see its photos.
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
              onClick={() => setShowInvite(true)}
              className="btn-secondary"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {isEventOwner && (
            <>
              <button
                onClick={() => setShowSettings(true)}
                className="btn-secondary"
              >
                <Settings size={16} />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={handleDeleteEvent}
                className="p-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete Event"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}

          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode)
              if (!isSelectionMode) setSelectedIds(new Set())
            }}
            className={isSelectionMode ? 'btn-blue' : 'btn-secondary'}
          >
            <CheckSquare size={16} />
            <span className="hidden sm:inline">{isSelectionMode ? 'Done' : 'Select'}</span>
          </button>
          
          <button
            onClick={loadPhotos}
            className="btn-icon"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          {user && !isSelectionMode && (
            <button
              id="toggle-upload-btn"
              onClick={() => setShowUpload((s) => !s)}
              className={showUpload ? 'btn-secondary' : 'btn-blue'}
            >
              <UploadCloud size={16} />
              {showUpload ? 'Hide Upload' : 'Upload'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-white/10 mb-6">
        <button
          onClick={() => setActiveTab('gallery')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'gallery' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Gallery
          {activeTab === 'gallery' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-500 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'canvas' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PenTool size={14} />
          Canvas
          {activeTab === 'canvas' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-500 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'notes' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Notes
          {activeTab === 'notes' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-500 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'notes' ? (
        <div className="animate-slide-up">
          <LiveNotes eventId={event.id} initialNotes={event.notes || ''} />
        </div>
      ) : activeTab === 'canvas' ? (
        <div className="animate-slide-up">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin-slow" />
                <span className="text-sm text-[#71717a]">Loading Canvas...</span>
              </div>
            </div>
          }>
            <MoodboardCanvas
              eventId={eventId!}
              userId={user!.id}
              photos={photos}
            />
          </Suspense>
        </div>
      ) : (
        <>
          {/* Pending Requests Banner (Owner Only) */}
          {canManageEvent && pendingMembers.length > 0 && (
        <div className="mb-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-slide-down">
          <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <Users size={16} />
            Pending Event Requests ({pendingMembers.length})
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

      {/* New photos banner */}
      {newPhotoCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6 cursor-pointer animate-slide-down"
          onClick={() => { loadPhotos(); setNewPhotoCount(0) }}
        >
          <span className="text-sm text-blue-300 font-medium">
            🔴 {newPhotoCount} new {newPhotoCount === 1 ? 'file' : 'files'} uploaded
          </span>
          <span className="text-xs text-blue-400 hover:underline">Click to refresh</span>
        </div>
      )}

      {/* Upload Zone */}
      {showUpload && user && (
        <div className="mb-8 p-6 card animate-slide-down">
          <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4 flex items-center gap-2">
            <Upload size={18} />
            Upload Photos & Videos
          </h2>
          <UploadZone
            eventId={eventId!}
            roomId={roomId!}
            userId={user.id}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>
      )}

      {/* Filter tabs */}
      {(imageCount > 0 || videoCount > 0 || uploadersList.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            {(['all', 'image', 'video'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  filter === f
                    ? 'bg-white/10 text-[#f4f4f5]'
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                {f === 'image' && <Image size={13} />}
                {f === 'video' && <Video size={13} />}
                {f === 'all' ? `All (${photos.length})` : f === 'image' ? `Photos (${imageCount})` : `Videos (${videoCount})`}
              </button>
            ))}
          </div>

          {uploadersList.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#71717a]">By:</label>
              <select
                className="input-base py-1.5 px-3 text-sm min-w-[140px]"
                value={uploaderFilter}
                onChange={(e) => setUploaderFilter(e.target.value)}
              >
                <option value="all">All Uploaders</option>
                {uploadersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Gallery */}
      {!isLoadingPhotos && photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No files yet"
          description="Upload photos and videos to start building this event's gallery."
          action={
            user ? (
              <button onClick={() => setShowUpload(true)} className="btn-blue">
                <UploadCloud size={18} />
                Upload Files
              </button>
            ) : undefined
          }
        />
      ) : (
        <PhotoGrid
          photos={photos}
          isLoading={isLoadingPhotos}
          activePhotoId={selectedPhoto?.id}
          onPhotoClick={(photo) => {
            setSelectedPhoto(photo)
          }}
          onPhotoDelete={handleDeletePhoto}
          canDelete={canDeletePhoto}
          selectedIds={isSelectionMode ? selectedIds : undefined}
          onToggleSelect={handleToggleSelect}
        />
      )}

      {/* Floating Action Bar for Selection Mode */}
      {isSelectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up pb-safe">
          <div className="mx-auto max-w-lg px-3 pb-4">
            <div className="bg-[#18181b]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-3 flex flex-col gap-3">
              {/* Top row: count + select all */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white px-1">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  {selectedIds.size === photos.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Action buttons — always centered and accessible */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleBatchIndividualDownload}
                  disabled={selectedIds.size === 0 || isDownloadingZip}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border border-white/10 text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
                >
                  <Download size={18} />
                  <span className="text-[11px] font-medium">Originals</span>
                </button>

                <button
                  onClick={handleBatchDownload}
                  disabled={selectedIds.size === 0 || isDownloadingZip}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-40 shadow-lg shadow-blue-900/30"
                >
                  {isDownloadingZip ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                      <span className="text-[11px] font-medium">{downloadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      <span className="text-[11px] font-medium">ZIP</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0 || isDownloadingZip}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                >
                  <Trash2 size={18} />
                  <span className="text-[11px] font-medium">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          <PhotoDetailModal
            photo={selectedPhoto}
            allPhotos={photos}
            onClose={() => {
              if (document.startViewTransition) {
                const transition = document.startViewTransition(() => setSelectedPhoto(null))
                transition.ready.catch(() => {})
                transition.finished.catch(() => {})
                transition.updateCallbackDone.catch(() => {})
              } else {
                setSelectedPhoto(null)
              }
            }}
            onNavigate={(photo) => setSelectedPhoto(photo)}
            onDelete={(photoId) => {
              const p = photos.find((x) => x.id === photoId)
              if (p) handleDeletePhoto(p)
            }}
            canDelete={selectedPhoto?.uploaderId === user?.id}
            onSetRoomCover={isRoomOwner ? async (url) => {
              if (!roomId) return
              const { error } = await updateRoomThumbnail(roomId, url)
              if (error) toast.error('Failed to update room cover')
              else toast.success('Room cover updated')
            } : undefined}
            onSetEventCover={isEventOwner ? async (url) => {
              if (!eventId) return
              const { error } = await updateEventThumbnail(eventId, url)
              if (error) toast.error('Failed to update event cover')
              else toast.success('Event cover updated')
            } : undefined}
          />
        </>
      )}

      <InviteMemberModal
        isOpen={showInvite}
        roomId={roomId!}
        eventId={eventId}
        roomName={room ? `${room.name} > ${event.title}` : event.title}
        onClose={() => setShowInvite(false)}
      />

      <EventSettingsModal
        isOpen={showSettings}
        event={event}
        onClose={() => setShowSettings(false)}
        onUpdate={(updates) => setEvent(prev => prev ? { ...prev, ...updates } : null)}
      />
    </div>
  )
}
