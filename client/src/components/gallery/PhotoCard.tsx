import { useState } from 'react'
import { Heart, MessageCircle, Play, Trash2 } from 'lucide-react'
import type { Photo } from '@/types'

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

export function PhotoCard({
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
  const isVideo = photo.mediaType === 'video'

  const handleClick = (e: React.MouseEvent) => {
    if (selectable) {
      e.stopPropagation()
      onSelect?.()
    } else {
      onClick?.()
    }
  }

  return (
    <div
      className={`masonry-item group relative cursor-pointer rounded-xl overflow-hidden bg-[#141414] border transition-all duration-200 ${
        selected ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.5)]' : 'border-white/[0.06] hover:border-white/[0.15]'
      }`}
      onClick={handleClick}
    >
      {/* Media */}
      <div className="relative bg-[#0f0f0f]">
        {imgError || !photo.thumbnailBase64 ? (
          <div className="w-full aspect-square bg-[#141414] flex items-center justify-center">
            <span className="text-[#52525b] text-xs">Preview unavailable</span>
          </div>
        ) : (
          <img
            src={photo.thumbnailBase64}
            alt={photo.filename}
            className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] min-h-[160px]"
            loading="lazy"
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
              <span className="badge-purple text-[10px] px-1.5 py-0.5">VIDEO</span>
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
                : 'bg-black/50 border-white/50 group-hover:border-white/80'
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
          <div className="flex items-center gap-3">
            {reactionCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/80">
                <Heart size={12} fill="currentColor" />
                {reactionCount}
              </span>
            )}
            {commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/80">
                <MessageCircle size={12} />
                {commentCount}
              </span>
            )}
          </div>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.() }}
              className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/40 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
