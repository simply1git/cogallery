import { useState, memo } from 'react'
import { Heart, MessageCircle, Play, Trash2, Download, Film, Image as ImageIcon } from 'lucide-react'
import type { Photo } from '@/types'
import { downloadFile } from '@/utils/download'
import { getSecureMediaUrl, downloadAndDecryptMedia } from '@/services/photoService'
import { toast } from 'sonner'
import { useRoomStore } from '@/store/roomStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { useHaptics } from '@/hooks/useHaptics'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
interface PhotoCardProps {
  photo: Photo
  onClick?: () => void
  onDelete?: () => void
  canDelete?: boolean
  reactionCount?: number
  commentCount?: number
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
}

export const PhotoCard = memo(function PhotoCard({
  photo,
  onClick,
  onDelete,
  canDelete,
  reactionCount = 0,
  commentCount = 0,
  selectable = false,
  selected = false,
  onSelect,
}: PhotoCardProps) {
  const [imgError, setImgError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const isVideo = photo.mediaType === 'video'
  const vaultKey = useRoomStore((s) => s.vaultKeys[photo.roomId])
  const [ref, inView] = useIntersectionObserver<HTMLDivElement>({ triggerOnce: true, rootMargin: '300px' })
  const { haptic } = useHaptics()
  const { url: mediaUrl, isDecrypting, error: mediaError } = useDecryptedMediaUrl(photo, inView ? vaultKey : undefined)

  const handleClick = (e: React.MouseEvent) => {
    if (selectable) {
      e.stopPropagation()
      haptic('light')
      onSelect?.()
    } else {
      haptic('light')
      onClick?.()
    }
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    haptic('medium')
    try {
      if (photo.isEncrypted && mediaUrl) {
        // We already have the decrypted Blob URL! Just trigger download.
        downloadFile(mediaUrl, photo.filename)
        return
      }

      toast.promise(
        (async () => {
          if (photo.isEncrypted && vaultKey) {
            return await downloadAndDecryptMedia(photo, vaultKey)
          } else if (photo.isEncrypted && !vaultKey) {
            throw new Error('Vault key missing')
          }
          return await getSecureMediaUrl(photo)
        })().then(url => {
          downloadFile(url, photo.filename)
          if (url.startsWith('blob:')) {
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }
        }),
        {
          loading: `Preparing ${photo.filename}...`,
          success: 'Download started',
          error: 'Failed to generate download link'
        }
      )
    } catch (err) {
      toast.error('Failed to generate download link')
    }
  }

  return (
    <div
      ref={ref}
      className={`group relative cursor-pointer rounded-xl overflow-hidden bg-[#0a0a0a] aspect-square transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 ${
        selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0a0a0a]' : ''
      }`}
      onClick={handleClick}
      // Add context menu action on mobile
      onContextMenu={() => {
        // We could block context menu or open our own
      }}
    >
      {/* Media */}
      <div className="relative bg-[#0f0f0f] flex items-center justify-center w-full h-full">
        {imgError || mediaError ? (
          <div className="w-full bg-[#141414] flex flex-col items-center justify-center gap-2 text-[#52525b] py-12">
            {isVideo ? <Film size={32} /> : <ImageIcon size={32} />}
            <span className="text-xs font-medium px-2 text-center break-all">{photo.filename}</span>
          </div>
        ) : isDecrypting ? (
          <div className="w-full flex flex-col items-center justify-center gap-2 text-blue-500/50 py-12">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs font-medium">Decrypting...</span>
          </div>
        ) : (
          <>
            {photo.thumbnailBase64 && (!isLoaded || !mediaUrl) && (
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img 
                  src={photo.thumbnailBase64} 
                  className="w-full h-full object-cover blur-sm scale-110 opacity-70" 
                  alt="placeholder" 
                />
              </div>
            )}
            {inView && mediaUrl && (
              <img
                src={mediaUrl}
                alt={photo.filename}
                loading="lazy"
                className={`w-full h-full object-cover block transition-all duration-500 group-hover:scale-[1.03] relative z-10 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setIsLoaded(true)}
                onError={() => setImgError(true)}
              />
            )}
          </>
        )}
        
        {isVideo && (
          <>
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-black/80 transition-colors z-20">
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
            {/* Video badge */}
            <div className="absolute top-2 left-2 pointer-events-none z-20">
              <span className="badge-purple text-[10px] px-1.5 py-0.5 shadow-md">VIDEO</span>
            </div>
          </>
        )}
      </div>

      {/* Selection Checkbox */}
      {selectable && (
        <div className="absolute top-2 right-2 z-10">
          <div 
            className={`w-6 h-6 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 ${
              selected 
                ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/30' 
                : 'bg-black/20 border-white/40 group-hover:bg-black/40 group-hover:border-white/80 backdrop-blur-md'
            }`}
          >
            {selected && (
              <svg width="12" height="9" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Hover overlay - clean minimalist gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-3">
          {/* Actions */}
          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 ease-out pointer-events-auto">
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-black/20 hover:bg-white/20 backdrop-blur-md text-white/90 hover:text-white transition-all hover:scale-110 active:scale-95"
              title="Download"
            >
              <Download size={14} strokeWidth={2.5} />
            </button>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.() }}
                className="p-2 rounded-full bg-black/20 hover:bg-red-500/40 backdrop-blur-md text-white/90 hover:text-red-100 transition-all hover:scale-110 active:scale-95"
                title="Delete"
              >
                <Trash2 size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
          
          {/* Info/Badges */}
          {(reactionCount > 0 || commentCount > 0) && (
            <div className="flex items-center gap-2.5">
              {reactionCount > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-black/30 backdrop-blur-md px-2 py-1 rounded-full border border-white/5">
                  <Heart size={10} fill="currentColor" className="text-red-500" />
                  {reactionCount}
                </div>
              )}
              {commentCount > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-black/30 backdrop-blur-md px-2 py-1 rounded-full border border-white/5">
                  <MessageCircle size={10} fill="currentColor" className="text-blue-400" />
                  {commentCount}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
