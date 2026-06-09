// React imports removed
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
}

export function DraggablePhoto({ item, onChange, onDelete, onBringToFront }: DraggablePhotoProps) {
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

  return (
    <motion.div
      drag
      dragControls={controls}
      dragMomentum={false}
      onDragStart={onBringToFront}
      onDragEnd={(_, info) => {
        onChange({
          ...item,
          x: item.x + info.offset.x,
          y: item.y + info.offset.y
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
      className="group rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-500/50 transition-shadow"
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
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <span className="text-xs text-red-400">Failed</span>
        </div>
      ) : url ? (
        <img
          src={url}
          alt={photo.filename}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      ) : null}
    </motion.div>
  )
}
