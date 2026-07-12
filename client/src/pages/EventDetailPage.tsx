import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Upload, Image, Video, Users,
  Loader2, Camera, RefreshCw, UploadCloud,
  X, Download, Trash2,
  CalendarDays, Check, PenTool
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { requestToJoinEvent, updateEventMemberStatus, deleteEvent, updateEventThumbnail } from '@/services/eventService'
import { updateRoomThumbnail } from '@/services/roomService'
import { uploadThumbnail } from '@/services/uploadService'
import { deletePhotoById, getSecureMediaUrl, downloadAndDecryptMedia } from '@/services/photoService'
import { useEvent } from '@/hooks/api/useEvent'
import { useEventPhotos } from '@/hooks/api/useEventPhotos'
import { useRoomStore } from '@/store/roomStore'
import { startSeeding } from '@/services/p2pService'
import { PhotoGrid } from '@/components/gallery/PhotoGrid'
import { PhotoDetailModal } from '@/components/gallery/PhotoDetailModal'
import { UploadZone } from '@/components/gallery/UploadZone'
import { usePresence } from '@/hooks/realtime/usePresence'
import { InviteMemberModal } from '@/components/modals/InviteMemberModal'
import { EventSettingsModal } from '@/components/modals/EventSettingsModal'
import { EventHeader } from '@/components/events/EventHeader'
import { LiveNotes } from '@/components/events/LiveNotes'
import { PageHeaderSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Photo } from '@/types'
import { downloadFilesAsZip } from '@/services/downloadService'
import { downloadFile } from '@/utils/download'
import { toastError, toastSuccess, toastLoading } from '@/lib/toast'

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

  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [uploaderFilter, setUploaderFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'gallery' | 'notes' | 'canvas'>('gallery')

  const { event, eventError, isLoadingEvent, room, uploadersList } = useEvent(eventId, roomId)
  const { 
    photos, 
    isLoadingPhotos, 
    isFetchingNextPage, 
    hasNextPage, 
    loadMore, 
    imageCount, 
    videoCount, 
    totalSize 
  } = useEventPhotos({ eventId, filter, uploaderFilter })

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isRequestingJoin, setIsRequestingJoin] = useState(false)

  const onlineUsers = useRoomStore(s => s.onlineUsers)
  const vaultKey = useRoomStore(s => s.vaultKeys[roomId!])
  usePresence(roomId || '', eventId || '')

  // P2P Seeding
  useEffect(() => {
    let stopSeeding: (() => void) | undefined
    if (user?.id && eventId) {
      stopSeeding = startSeeding(eventId, user.id)
    }
    return () => {
      stopSeeding?.()
    }
  }, [eventId, user?.id])

  // New photo indicator handler
  useEffect(() => {
    // Determine if we need to show banner based on cache size changes
    // This could be sophisticated, but for now React Query handles auto-refresh via realtime
  }, [photos.length])

  // Selection state

  function handleUploadSuccess() {
    // React Query handles cache update via realtime subscription automatically
    toastSuccess('Upload completed');
  }

  async function handleDeletePhoto(photo: Photo) {
    const { error } = await deletePhotoById(photo.id, photo.s3Key!)
    if (error) { toastError(error); return }
    toastSuccess('Deleted')
  }

  const handleDeleteEvent = async () => {
    if (!event) return
    if (!window.confirm(`Are you sure you want to permanently delete the event "${event.title}"? This will delete all photos inside it.`)) return

    const { error } = await deleteEvent(event.id)
    if (error) {
      toastError('Failed to delete event')
    } else {
      toastSuccess('Event deleted successfully')
      navigate(`/room/${roomId}`)
    }
  }

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

    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    const result = await downloadFilesAsZip(
      selectedPhotos, 
      `${event?.title || 'Event'}_Export`
    )

    if (!result.success) {
      toastError(result.error || 'Download failed')
    } else {
      toastSuccess('Download started in your browser!')
      setIsSelectionMode(false)
      setSelectedIds(new Set())
    }
  }

  const handleBatchIndividualDownload = async () => {
    if (selectedIds.size === 0) return
    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    
    // Download them individually sequentially to not crash the browser
    let count = 0;
    const loadingToast = toastLoading(`Downloading ${selectedPhotos.length} files...`);

    for (const p of selectedPhotos) {
      count++;
      toastLoading(`Downloading ${count} of ${selectedPhotos.length}: ${p.filename}`, { id: loadingToast });

      if (p.s3Url) {
         let targetUrl = p.s3Url;
         if (p.isEncrypted && vaultKey) {
            try { 
               // Wait for the full file to be downloaded and decrypted to a blob URL in RAM
               targetUrl = await downloadAndDecryptMedia(p, vaultKey) 
            } catch (e) {
               console.error('Decryption failed for', p.filename, e)
               toastError(`Failed to decrypt ${p.filename}`)
               continue
            }
         } else if (p.isEncrypted && !vaultKey) {
            toastError(`No vault key available for ${p.filename}`)
            continue
         } else if (!p.isEncrypted && targetUrl?.includes('pending')) {
            try { targetUrl = await getSecureMediaUrl(p) } catch(e) {}
         }
         await downloadFile(targetUrl, p.filename)
         
         // Cleanup Blob URL to free RAM after download starts
         if (targetUrl.startsWith('blob:')) {
           setTimeout(() => URL.revokeObjectURL(targetUrl), 1000)
         }
      }
      // Small pause between downloads to allow the browser to process and prompt Save As
      await new Promise(res => setTimeout(res, 500))
    }
    
    toastSuccess(`Successfully downloaded ${count} files`, { id: loadingToast })
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
      toastError('You can only delete your own photos.')
    }

    for (const photo of toDelete) {
      const { error } = await deletePhotoById(photo.id, photo.s3Key!)
      if (error) errCount++
      else deletedCount++
    }

    if (deletedCount > 0) {
      toastSuccess(`Deleted ${deletedCount} items`)
    }
    if (errCount > 0) toastError(`Failed to delete ${errCount} items`)
    
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }

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
      toastError(error)
    } else {
      toastSuccess('Request sent!')
      // Reloading is unnecessary; the UI will update via other means if needed.
    }
  }

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    if (!eventId) return
    const { error } = await updateEventMemberStatus(eventId, userId, status)
    if (!error) {
      toastSuccess(`User ${status}`)
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
      {/* Event Header Component */}
      <EventHeader
        event={event}
        room={room}
        roomId={roomId}
        imageCount={imageCount}
        videoCount={videoCount}
        totalSize={totalSize}
        onlineUsers={onlineUsers[roomId!] || []}
        canManageEvent={canManageEvent}
        isEventOwner={isEventOwner}
        isSelectionMode={isSelectionMode}
        showUpload={showUpload}
        onToggleSelectionMode={() => {
          setIsSelectionMode(!isSelectionMode)
          if (!isSelectionMode) setSelectedIds(new Set())
        }}
        onRefresh={() => { /* React Query handles cache invalidation on manual refresh */ }}
        onToggleUpload={() => setShowUpload(s => !s)}
        onShowInvite={() => setShowInvite(true)}
        onShowSettings={() => setShowSettings(true)}
        onDeleteEvent={handleDeleteEvent}
      />

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

      {/* New photos banner (handled by React Query but we can leave a simple placeholder or remove it) */}

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

      {/* Filter tabs - Segmented Control Style */}
      {(imageCount > 0 || videoCount > 0 || uploadersList.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center bg-white/5 p-1 rounded-xl">
            {(['all', 'image', 'video'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-sm px-4 py-1.5 rounded-lg transition-all duration-300 flex items-center gap-1.5 font-medium ${
                  filter === f
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-[#71717a] hover:text-[#f4f4f5] hover:bg-white/5'
                }`}
              >
                {f === 'image' && <Image size={14} />}
                {f === 'video' && <Video size={14} />}
                {f === 'all' ? `All` : f === 'image' ? `Photos` : `Videos`}
              </button>
            ))}
          </div>

          {uploadersList.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#71717a] font-medium">Uploader</label>
              <select
                className="bg-white/5 border border-white/10 rounded-xl py-1.5 px-3 text-sm min-w-[140px] text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={uploaderFilter}
                onChange={(e) => setUploaderFilter(e.target.value)}
              >
                <option value="all">Everyone</option>
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
          onPhotoClick={(photo) => setSelectedPhoto(photo)}
          onPhotoDelete={handleDeletePhoto}
          canDelete={(photo) => user?.id === event.creatorId || user?.id === photo.uploaderId}
          isLoading={isLoadingPhotos}
          selectedIds={isSelectionMode ? selectedIds : undefined}
          onToggleSelect={handleToggleSelect}
          activePhotoId={selectedPhoto?.id}
          hasMore={hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={() => loadMore()}
        />
      )}

      {/* Floating Action Bar for Selection Mode */}
      {isSelectionMode && (
        <div className="fixed bottom-[68px] md:bottom-0 left-0 right-0 z-[60] animate-slide-up pb-safe">
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
              <div className={`grid ${room?.isVault ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                <button
                  onClick={handleBatchIndividualDownload}
                  disabled={selectedIds.size === 0}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border border-white/10 text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
                >
                  <Download size={18} />
                  <span className="text-[11px] font-medium">Download</span>
                </button>

                {!room?.isVault && (
                  <button
                    onClick={handleBatchDownload}
                    disabled={selectedIds.size === 0}
                    className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-40 shadow-lg shadow-blue-900/30"
                  >
                    <Download size={18} />
                    <span className="text-[11px] font-medium">ZIP</span>
                  </button>
                )}

                <button
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0}
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
            onSetRoomCover={isRoomOwner ? async (url, file) => {
              if (!roomId) return
              let finalUrl = url
              if (file) {
                const result = await uploadThumbnail(file, roomId)
                if (result.success && result.url) finalUrl = result.url
                else return toastError('Failed to upload cover')
              }
              const { error } = await updateRoomThumbnail(roomId, finalUrl)
              if (error) toastError('Failed to update room cover')
              else toastSuccess('Room cover updated')
            } : undefined}
            onSetEventCover={isEventOwner ? async (url, file) => {
              if (!eventId) return
              let finalUrl = url
              if (file) {
                const result = await uploadThumbnail(file, eventId)
                if (result.success && result.url) finalUrl = result.url
                else return toastError('Failed to upload cover')
              }
              const { error } = await updateEventThumbnail(eventId, finalUrl)
              if (error) toastError('Failed to update event cover')
              else toastSuccess('Event cover updated')
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
        onUpdate={() => { /* Will invalidate query in the modal component */ }}
      />
    </div>
  )
}
