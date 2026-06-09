// React imports removed
import { useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { useCanvasStore } from '@/store/canvasStore'
import { useRoomStore } from '@/store/roomStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { CanvasItem } from '@/hooks/useMoodboardSync'
import { Loader2, ImageOff, Trash2 } from 'lucide-react'

interface DraggablePhotoProps {
  item: CanvasItem
  onChange: (item: CanvasItem) => void
  onDelete: (id: string) => void
  onBringToFront: () => void
  onDoubleClick?: (photoId: string) => void
}

export function DraggablePhoto({ item, onChange, onDelete, onBringToFront, onDoubleClick }: DraggablePhotoProps) {
  const photos = useCanvasStore((s) => s.photos)
  const photo = photos.find((p) => p.id === item.photoId)
  const vaultKey = useRoomStore((s) => photo ? s.vaultKeys[photo.roomId] : undefined)

  const { url, isDecrypting, error } = useDecryptedMediaUrl(photo as any, vaultKey, false)
  const controls = useDragControls()

  if (!photo) {
    return (
      <motion.div
        className="absolute flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm"
        style={{ width: item.w, height: item.h, x: item.x, y: item.y, zIndex: item.zIndex }}
      >
        <div className="flex flex-col items-center gap-2 text-zinc-500">
          <ImageOff size={24} />
          <span className="text-xs">Photo not found</span>
        </div>
      </motion.div>
    )
  }

  const [isResizing, setIsResizing] = useState(false)

  // Natural aspect ratio state (width / height)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight)
    }
  }

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startW = item.w
    const startH = item.h

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      // If we have an aspect ratio, derive deltaY from deltaX so it scales proportionally
      const newW = Math.max(100, startW + deltaX)
      const newH = aspectRatio ? newW / aspectRatio : Math.max(100, startH + (moveEvent.clientY - startY))

      onChange({
        ...item,
        w: newW,
        h: newH
      })
    }

    const onPointerUp = () => {
      setIsResizing(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <motion.div
      drag={!isResizing}
      dragControls={controls}
      dragMomentum={false}
      onPointerDown={onBringToFront}
      onDragStart={onBringToFront}
      onDoubleClick={() => onDoubleClick?.(photo.id)}
      onDragEnd={(_, info) => {
        if (isResizing) return
        // Magnetic Grid Snapping (20px)
        const snap = 20
        const newX = Math.round((item.x + info.offset.x) / snap) * snap
        const newY = Math.round((item.y + info.offset.y) / snap) * snap
        
        onChange({
          ...item,
          x: newX,
          y: newY
        })
      }}
      initial={{ x: item.x, y: item.y, scale: 0.8, opacity: 0 }}
      animate={{ x: item.x, y: item.y, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        width: item.w,
        height: item.h,
        position: 'absolute',
        zIndex: item.zIndex,
      }}
      className="group rounded-xl shadow-2xl border border-white/10 bg-black cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-500/50 transition-shadow"
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-md backdrop-blur-md"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {isDecrypting && !url ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl">
          <span className="text-xs text-red-400">Failed</span>
        </div>
      ) : url ? (
        <img
          src={url}
          alt={photo.filename}
          onLoad={handleImageLoad}
          className="w-full h-full object-contain pointer-events-none rounded-xl"
          draggable={false}
        />
      ) : null}

      {/* Resize Handle */}
      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end justify-end p-1"
      >
        <div className="w-3 h-3 bg-blue-500 rounded-tl-sm rounded-br-lg shadow-sm" />
      </div>
    </motion.div>
  )
}
