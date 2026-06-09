import { useEffect, useState, useCallback } from 'react'
import {
  X, ChevronLeft, ChevronRight, Download, Trash2,
  MessageCircle, Camera, Calendar, HardDrive, Image as ImageIcon, Layout,
  ChevronUp, ChevronDown
} from 'lucide-react'
import { motion } from 'framer-motion'
import { getPhotoDetails, addReaction, addComment, deleteComment } from '@/services/photoService'
import { useAuth } from '@/hooks/useAuth'
import type { Photo, PhotoWithReactions, Comment } from '@/types'
import { formatFileSize } from '@/services/uploadService'
import { downloadFile } from '@/utils/download'
import { toast } from 'sonner'
import { useRoomStore } from '@/store/roomStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { useColorExtractor } from '@/hooks/useColorExtractor'
import { useHaptics } from '@/hooks/useHaptics'

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
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  
  const vaultKey = useRoomStore((s) => s.vaultKeys[photo?.roomId || ''])
  const { url: secureUrl, isDecrypting } = useDecryptedMediaUrl(photo!, vaultKey, true)
  const { url: thumbUrl } = useDecryptedMediaUrl(photo!, vaultKey, false)
  const { ambientStyle } = useColorExtractor(!photo?.mediaType.startsWith('video') ? secureUrl : undefined)
  const { haptic } = useHaptics()

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
    }
  }, [photo, loadDetails])

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
    haptic('light')
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
    if (!photo || !secureUrl) return
    haptic('medium')
    if (photo.isEncrypted && secureUrl) {
      await downloadFile(secureUrl, photo.filename)
      return
    }
    await downloadFile(secureUrl, photo.filename)
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
    <div 
      className="lightbox-overlay animate-fade-in transition-colors duration-1000 ease-in-out" 
      onClick={onClose}
      style={{ backgroundColor: ambientStyle || 'rgba(0, 0, 0, 0.95)' }}
    >
      {/* Close */}
      <button className="absolute top-3 right-3 z-30 btn-icon bg-black/60 backdrop-blur-sm border border-white/10 mt-safe" onClick={onClose}>
        <X size={20} />
      </button>

      {/* Nav arrows */}
      {hasPrev && (
        <button
          className="absolute left-2 md:left-4 top-1/3 md:top-1/2 -translate-y-1/2 z-10 btn-icon bg-black/40 backdrop-blur-md border border-white/10 p-2 md:p-3 hover:scale-105 active:scale-95 transition-transform"
          onClick={(e) => { 
            e.stopPropagation(); 
            haptic('light');
            onNavigate(allPhotos[currentIndex - 1]) 
          }}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {hasNext && (
        <button
          className="absolute right-2 md:right-[340px] top-1/3 md:top-1/2 -translate-y-1/2 z-10 btn-icon bg-black/40 backdrop-blur-md border border-white/10 p-2 md:p-3 hover:scale-105 active:scale-95 transition-transform"
          onClick={(e) => { 
            e.stopPropagation(); 
            haptic('light');
            onNavigate(allPhotos[currentIndex + 1]) 
          }}
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Main content */}
      <div className="flex flex-col md:flex-row w-full h-full max-w-7xl mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* Media area */}
        <div className={`flex-1 flex flex-col items-center justify-center p-3 md:p-8 min-w-0 relative overflow-hidden ${showMobilePanel ? 'hidden md:flex' : ''}`}>
          
          {isVideo ? (
            <motion.div 
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={(_e, info) => {
                if (Math.abs(info.offset.y) > 100) onClose()
              }}
              className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              {secureUrl ? (
                <video
                  key={photo.id}
                  src={secureUrl}
                  controls
                  playsInline
                  autoPlay
                  poster={thumbUrl || ''}
                  className="max-w-full max-h-[85vh] md:max-h-full object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : isDecrypting ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-blue-400">Decrypting...</span>
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  {thumbUrl && (
                    <img 
                      src={thumbUrl} 
                      className="max-w-full max-h-[85vh] md:max-h-full object-contain rounded-lg shadow-2xl blur-md opacity-50" 
                      alt="loading" 
                    />
                  )}
                  <div className="absolute w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.7}
              whileDrag={{ scale: 0.95 }}
              onDragEnd={(_e, info) => {
                const swipeThreshold = 50;
                if (info.offset.x > swipeThreshold && hasPrev) {
                  haptic('light');
                  onNavigate(allPhotos[currentIndex - 1]);
                }
                else if (info.offset.x < -swipeThreshold && hasNext) {
                  haptic('light');
                  onNavigate(allPhotos[currentIndex + 1]);
                }
                else if (info.offset.y > swipeThreshold * 2) {
                  haptic('medium');
                  onClose();
                }
              }}
              className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              {secureUrl ? (
                <img
                  key={`secure-${photo.id}`}
                  src={secureUrl}
                  alt={photo.filename}
                  className="max-w-full max-h-[85vh] md:max-h-full object-contain rounded-lg shadow-2xl select-none pointer-events-none"
                  style={{ viewTransitionName: `photo-${photo.id}` }}
                  draggable={false}
                />
              ) : isDecrypting ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-blue-400">Decrypting...</span>
                </div>
              ) : (
                <img
                  key={`fallback-${photo.id}`}
                  src={thumbUrl || ''} // use decrypted thumbnail while loading secure URL
                  alt={photo.filename}
                  className="max-w-full max-h-[85vh] md:max-h-full object-contain rounded-lg shadow-2xl select-none pointer-events-none blur-sm transition-all"
                  style={{ viewTransitionName: `photo-${photo.id}` }}
                  draggable={false}
                />
              )}
            </motion.div>
          )}

          {/* Counter + mobile panel toggle */}
          <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <span className="text-xs md:text-sm text-white/50">
              {currentIndex + 1} / {allPhotos.length}
            </span>
            <button
              className="md:hidden btn-icon bg-black/60 backdrop-blur-sm border border-white/10 p-1.5"
              onClick={() => setShowMobilePanel(!showMobilePanel)}
            >
              {showMobilePanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {/* Side panel */}
        <div className={`w-full md:w-80 flex-shrink-0 flex flex-col bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-white/[0.08] md:h-full ${showMobilePanel ? 'h-full' : 'hidden md:flex'}`}>
          {/* Mobile back button */}
          <button
            className="md:hidden flex items-center gap-2 px-4 py-2 text-sm text-[#71717a] hover:text-white border-b border-white/[0.08]"
            onClick={() => setShowMobilePanel(false)}
          >
            <ChevronDown size={16} />
            Back to photo
          </button>
          {/* Top actions */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-sm font-medium text-[#f4f4f5] truncate flex-1 mr-2">
              {photo.filename}
            </span>
            <div className="flex items-center gap-1">
              {onSetRoomCover && photo.s3Url && (
                <button onClick={() => { onSetRoomCover(photo.s3Url!); onClose() }} className="btn-icon" title="Set as Room Cover">
                  <Layout size={16} />
                </button>
              )}
              {onSetEventCover && photo.s3Url && (
                <button onClick={() => { onSetEventCover(photo.s3Url!); onClose() }} className="btn-icon" title="Set as Event Cover">
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
