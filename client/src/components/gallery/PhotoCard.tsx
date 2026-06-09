import { useState, memo } from 'react'
import { Heart, MessageCircle, Play, Trash2, Download, Film, Image as ImageIcon } from 'lucide-react'
import type { Photo } from '@/types'
import { downloadFile } from '@/utils/download'
import { getSecureMediaUrl } from '@/services/photoService'
import { toast } from 'sonner'
import { useRoomStore } from '@/store/roomStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { motion } from 'framer-motion'
import { useHaptics } from '@/hooks/useHaptics'

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
  isActiveTransition?: boolean
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
  isActiveTransition = false,
}: PhotoCardProps) {
  const [imgError, setImgError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const isVideo = photo.mediaType === 'video'
  const vaultKey = useRoomStore((s) => s.vaultKeys[photo.roomId])
  const { url: mediaUrl, isDecrypting, error: mediaError } = useDecryptedMediaUrl(photo, vaultKey)
  const { haptic } = useHaptics()

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

      let s3Key = photo.s3Key;
      if (!s3Key) {
        if (photo.s3Url?.includes('.r2.dev/')) s3Key = photo.s3Url.split('.r2.dev/')[1];
        else if (photo.s3Url?.includes('/stream/')) s3Key = photo.s3Url.split('/stream/')[1];
        else if (photo.s3Url?.includes('/proxy/')) s3Key = photo.s3Url.split('/proxy/')[1];
        else s3Key = photo.filename;
      }
      
      const secureUrl = await getSecureMediaUrl(s3Key)
      downloadFile(secureUrl, photo.filename)
    } catch (err) {
      toast.error('Failed to generate download link')
    }
  }

  return (
    <motion.div
      layout
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`masonry-item group relative cursor-pointer rounded-xl overflow-hidden bg-[#141414] border transition-colors duration-200 ${
        selected ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.5)]' : 'border-white/[0.06] hover:border-white/[0.15]'
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '200px' }}
      onClick={handleClick}
      // Add context menu action on mobile
      onContextMenu={() => {
        // We could block context menu or open our own
      }}
    >
      {/* Media */}
      <div className="relative bg-[#0f0f0f] flex items-center justify-center min-h-[150px]">
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
          <img
            src={mediaUrl}
            alt={photo.filename}
            className={`w-full h-auto block transition-all duration-500 group-hover:scale-[1.03] ${
              isLoaded ? 'blur-0 opacity-100' : 'blur-sm opacity-0'
            }`}
            style={{ viewTransitionName: isActiveTransition ? undefined : `photo-${photo.id}` }}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
        
        {isVideo && (
          <>
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
            {/* Video badge */}
            <div className="absolute top-2 left-2 pointer-events-none">
              <span className="badge-purple text-[10px] px-1.5 py-0.5 shadow-md">VIDEO</span>
            </div>
          </>
        )}
      </div>

      {/* Selection Checkbox */}
      {selectable && (
        <div className="absolute top-2 right-2 z-10">
          <div 
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              selected 
                ? 'bg-blue-500 border-blue-500' 
                : 'bg-black/50 border-white/50 group-hover:border-white/80 backdrop-blur-md'
            }`}
          >
            {selected && (
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-2">
          {/* Top of hover area - actions */}
          <div className="flex items-center justify-end gap-2 mb-1 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all"
              title="Download"
            >
              <Download size={14} />
            </button>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.() }}
                className="p-1.5 rounded-lg bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-400 hover:bg-red-500/40 hover:scale-105 transition-all"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          
          {/* Bottom of hover area - info */}
          <div className="flex items-center gap-3">
            {reactionCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-white shadow-sm font-medium">
                <Heart size={12} fill="currentColor" className="text-red-500" />
                {reactionCount}
              </span>
            )}
            {commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-white shadow-sm font-medium">
                <MessageCircle size={12} />
                {commentCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
})
