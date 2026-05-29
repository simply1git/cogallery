import { useEffect, useState, useCallback } from 'react'
import {
  X, ChevronLeft, ChevronRight, Download, Trash2,
  MessageCircle, Camera, Calendar, HardDrive, Image as ImageIcon, Layout
} from 'lucide-react'
import { getPhotoDetails, addReaction, addComment, deleteComment } from '@/services/photoService'
import { useAuth } from '@/hooks/useAuth'
import type { Photo, PhotoWithReactions, Comment } from '@/types'
import { formatFileSize } from '@/services/uploadService'
import { requestFile } from '@/services/p2pService'
import { getCachedFile } from '@/services/photoCache'
import { toast } from 'sonner'

const EMOJI_LIST = ['❤️', '😍', '🔥', '😂', '😮', '👏', '🎉', '😢']

interface PhotoDetailModalProps {
  photo: Photo | null
  allPhotos: Photo[]
  onClose: () => void
  onNavigate: (photo: Photo) => void
  onDelete?: (photoId: string) => void
  canDelete?: boolean
  onSetRoomCover?: (url: string) => void
  onSetEventCover?: (url: string) => void
}

export function PhotoDetailModal({
  photo,
  allPhotos,
  onClose,
  onNavigate,
  onDelete,
  canDelete,
  onSetRoomCover,
  onSetEventCover,
}: PhotoDetailModalProps) {
  const { user } = useAuth()
  const [details, setDetails] = useState<PhotoWithReactions | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [activeTab, setActiveTab] = useState<'reactions' | 'comments' | 'info'>('reactions')
  const [_isPlaying, _setIsPlaying] = useState(false)
  
  // P2P State
  const [p2pUrl, setP2pUrl] = useState<string | null>(null)
  const [p2pProgress, setP2pProgress] = useState<number>(0)
  const [p2pStatus, setP2pStatus] = useState<'idle' | 'requesting' | 'streaming' | 'done' | 'offline'>('idle')
  const [p2pBlob, setP2pBlob] = useState<Blob | null>(null)

  const currentIndex = allPhotos.findIndex((p) => p.id === photo?.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allPhotos.length - 1

  const loadDetails = useCallback(async (p: Photo) => {
    setIsLoadingDetails(true)
    const data = await getPhotoDetails(p.id)
    setDetails(data)
    setIsLoadingDetails(false)
  }, [])

  useEffect(() => {
    if (photo) {
      loadDetails(photo)
      
      // Reset P2P state
      setP2pUrl(null)
      setP2pBlob(null)
      setP2pProgress(0)
      
      const isP2P = photo.s3Key.startsWith('p2p:')
      
      if (isP2P && user) {
        // First check if we already have it in our own cache (we are the uploader)
        getCachedFile(photo.id).then(cached => {
          if (cached) {
            setP2pStatus('done')
            setP2pBlob(cached.blob)
            setP2pUrl(URL.createObjectURL(cached.blob))
          } else {
            // Not in local cache, request from peers
            setP2pStatus('requesting')
            
            requestFile(
              photo.eventId,
              photo.id,
              user.id,
              (progress) => {
                setP2pStatus('streaming')
                setP2pProgress(progress)
              },
              undefined, // we handle the blob in the Promise resolution
              10000 // 10s timeout
            ).then((res) => {
              if (res) {
                setP2pStatus('done')
                setP2pBlob(res.blob)
                setP2pUrl(URL.createObjectURL(res.blob))
              } else {
                setP2pStatus('offline')
              }
            })
          }
        })
      } else {
        setP2pStatus('idle')
      }
    }
    
    return () => {
      // Cleanup object URL
      if (p2pUrl) URL.revokeObjectURL(p2pUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, user?.id])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allPhotos[currentIndex - 1])
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allPhotos[currentIndex + 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hasPrev, hasNext, currentIndex, allPhotos, onNavigate])

  if (!photo) return null
  const isVideo = photo.mediaType === 'video'

  async function handleReaction(emoji: string) {
    if (!user || !photo) { toast.error('Sign in to react'); return }
    await addReaction(photo.id, emoji, user.id)
    loadDetails(photo)
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !commentText.trim() || !photo) return
    setIsSubmittingComment(true)
    const { error } = await addComment(photo.id, commentText.trim(), user.id)
    setIsSubmittingComment(false)
    if (error) { toast.error(error); return }
    setCommentText('')
    loadDetails(photo)
  }

  async function handleDeleteComment(comment: Comment) {
    const { error } = await deleteComment(comment.id)
    if (error) { toast.error(error); return }
    loadDetails(photo!)
  }

  async function handleDownload() {
    if (!photo) return
    
    if (p2pBlob) {
      // P2P download
      const a = document.createElement('a')
      a.href = URL.createObjectURL(p2pBlob)
      a.download = photo.filename
      a.click()
    } else if (photo.s3Url) {
      // Cloud download
      const res = await fetch(photo.s3Url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = photo.filename
      a.click()
    } else {
      toast.error('Original file is currently unavailable (uploader offline).')
    }
  }

  // Group reactions by emoji
  const reactionGroups = details?.reactions.reduce<Record<string, { count: number; userIds: string[] }>>(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, userIds: [] }
      acc[r.emoji].count++
      acc[r.emoji].userIds.push(r.userId)
      return acc
    },
    {}
  ) ?? {}

  return (
    <div className="lightbox-overlay animate-fade-in" onClick={onClose}>
      {/* Close */}
      <button className="absolute top-4 right-4 z-10 btn-icon" onClick={onClose}>
        <X size={22} />
      </button>

      {/* Nav arrows */}
      {hasPrev && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 btn-icon bg-black/40 border border-white/10 p-3"
          onClick={(e) => { e.stopPropagation(); onNavigate(allPhotos[currentIndex - 1]) }}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {hasNext && (
        <button
          className="absolute right-[340px] top-1/2 -translate-y-1/2 z-10 btn-icon bg-black/40 border border-white/10 p-3"
          onClick={(e) => { e.stopPropagation(); onNavigate(allPhotos[currentIndex + 1]) }}
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Main content */}
      <div className="flex w-full h-full max-w-7xl mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* Media area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 min-w-0 relative">
          
          {/* P2P Status Overlay */}
          {photo.s3Key.startsWith('p2p:') && p2pStatus !== 'done' && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-xl animate-fade-in">
              {p2pStatus === 'requesting' && (
                <>
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  Connecting to peers...
                </>
              )}
              {p2pStatus === 'streaming' && (
                <>
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  Streaming full resolution ({p2pProgress}%)
                </>
              )}
              {p2pStatus === 'offline' && (
                <>
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Uploader offline. Showing preview only.
                </>
              )}
            </div>
          )}

          {isVideo ? (
            <div className="relative max-h-full">
              {/* Show preview thumbnail if P2P video is not yet loaded */}
              {photo.s3Key.startsWith('p2p:') && p2pStatus !== 'done' && photo.thumbnailBase64 ? (
                <img
                  src={photo.thumbnailBase64}
                  className="max-w-full max-h-[85vh] rounded-xl object-contain opacity-50 blur-sm"
                  alt="Video preview"
                />
              ) : (
                <video
                  src={p2pUrl || photo.s3Url}
                  className="max-w-full max-h-[85vh] rounded-xl object-contain"
                  controls
                  autoPlay={!!p2pUrl} // Autoplay when stream finishes
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ) : (
            <img
              src={p2pUrl || photo.s3Url || photo.thumbnailBase64}
              alt={photo.filename}
              className={`max-w-full max-h-[85vh] object-contain rounded-xl animate-scale-in transition-all duration-500 ${
                !p2pUrl && !photo.s3Url ? 'blur-sm scale-[0.98]' : ''
              }`}
            />
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/50">
            {currentIndex + 1} / {allPhotos.length}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-[#0a0a0a] border-l border-white/[0.08]">
          {/* Top actions */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-sm font-medium text-[#f4f4f5] truncate flex-1 mr-2">
              {photo.filename}
            </span>
            <div className="flex items-center gap-1">
              {onSetRoomCover && (
                <button onClick={() => { onSetRoomCover(photo.s3Url); onClose() }} className="btn-icon" title="Set as Room Cover">
                  <Layout size={16} />
                </button>
              )}
              {onSetEventCover && (
                <button onClick={() => { onSetEventCover(photo.s3Url); onClose() }} className="btn-icon" title="Set as Event Cover">
                  <ImageIcon size={16} />
                </button>
              )}
              <button onClick={handleDownload} className="btn-icon" title="Download">
                <Download size={16} />
              </button>
              {canDelete && onDelete && (
                <button
                  onClick={() => { onDelete(photo.id); onClose() }}
                  className="btn-icon text-red-400 hover:text-red-300"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.08]">
            {(['reactions', 'comments', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingDetails ? (
              <div className="space-y-3">
                {[1,2,3].map((i) => <div key={i} className="skeleton h-8 rounded-lg" />)}
              </div>
            ) : (
              <>
                {/* REACTIONS TAB */}
                {activeTab === 'reactions' && (
                  <div className="space-y-4">
                    {/* Emoji picker */}
                    <div>
                      <p className="text-xs text-[#71717a] mb-2">React to this {isVideo ? 'video' : 'photo'}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {EMOJI_LIST.map((emoji) => {
                          const group = reactionGroups[emoji]
                          const hasReacted = group?.userIds.includes(user?.id ?? '')
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(emoji)}
                              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all duration-150 active:scale-90 ${
                                hasReacted
                                  ? 'border-blue-500/50 bg-blue-500/10'
                                  : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                              }`}
                            >
                              <span className="text-xl leading-none">{emoji}</span>
                              {group && (
                                <span className="text-[10px] text-[#a1a1aa]">{group.count}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Reaction summary */}
                    {Object.keys(reactionGroups).length > 0 && (
                      <div>
                        <p className="text-xs text-[#71717a] mb-2">Reactions</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(reactionGroups).map(([emoji, { count }]) => (
                            <span key={emoji} className="badge badge-blue gap-1.5">
                              <span>{emoji}</span>
                              <span>{count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* COMMENTS TAB */}
                {activeTab === 'comments' && (
                  <div className="space-y-3">
                    {(details?.comments ?? []).length === 0 ? (
                      <div className="text-center py-6">
                        <MessageCircle size={28} className="text-[#3f3f46] mx-auto mb-2" />
                        <p className="text-sm text-[#71717a]">No comments yet</p>
                      </div>
                    ) : (
                      (details?.comments ?? []).map((c) => (
                        <div key={c.id} className="group flex gap-2 items-start">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">
                            {c.userId.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#f4f4f5] break-words">{c.body}</p>
                            <p className="text-[10px] text-[#52525b] mt-0.5">
                              {new Date(c.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {(user?.id === c.userId) && (
                            <button
                              onClick={() => handleDeleteComment(c)}
                              className="opacity-0 group-hover:opacity-100 btn-icon p-1 text-[#52525b] hover:text-red-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    )}

                    {/* Comment input */}
                    {user && (
                      <form onSubmit={handleComment} className="flex gap-2 pt-2 border-t border-white/[0.07]">
                        <input
                          className="input-base flex-1 text-sm py-2"
                          placeholder="Add a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          maxLength={500}
                        />
                        <button
                          type="submit"
                          className="btn-blue px-3 py-2 text-sm"
                          disabled={isSubmittingComment || !commentText.trim()}
                        >
                          Post
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* INFO TAB */}
                {activeTab === 'info' && (
                  <div className="space-y-3 text-sm">
                    <InfoRow icon={<HardDrive size={14} />} label="Size" value={formatFileSize(photo.fileSizeBytes)} />
                    <InfoRow icon={<Camera size={14} />} label="Type" value={photo.mediaType === 'video' ? 'Video' : 'Image'} />
                    <InfoRow
                      icon={<Calendar size={14} />}
                      label="Uploaded"
                      value={new Date(photo.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    />
                    {photo.cameraMake && (
                      <InfoRow icon={<Camera size={14} />} label="Camera" value={`${photo.cameraMake} ${photo.cameraModel ?? ''}`} />
                    )}
                    {photo.iso && <InfoRow icon={<Camera size={14} />} label="ISO" value={String(photo.iso)} />}
                    {photo.latitude && photo.longitude && (
                      <InfoRow
                        icon={<Camera size={14} />}
                        label="Location"
                        value={`${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[#52525b] mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[#71717a] text-xs">{label}</p>
        <p className="text-[#d4d4d8] text-sm">{value}</p>
      </div>
    </div>
  )
}
