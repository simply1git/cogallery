import { motion, useDragControls } from 'framer-motion'
import { CanvasItem } from '@/hooks/useMoodboardSync'
import { Trash2 } from 'lucide-react'

interface DraggableEmojiProps {
  item: CanvasItem
  onChange: (item: CanvasItem) => void
  onDelete: (id: string) => void
  onBringToFront: () => void
}

export function DraggableEmoji({ item, onChange, onDelete, onBringToFront }: DraggableEmojiProps) {
  const controls = useDragControls()

  return (
    <motion.div
      drag
      dragControls={controls}
      dragMomentum={false}
      onDragStart={onBringToFront}
      onDragEnd={(_, info) => {
        const snap = 20
        const newX = Math.round((item.x + info.offset.x) / snap) * snap
        const newY = Math.round((item.y + info.offset.y) / snap) * snap
        onChange({
          ...item,
          x: newX,
          y: newY
        })
      }}
      initial={{ x: item.x, y: item.y, scale: 0.1, opacity: 0, rotate: -20 }}
      animate={{ x: item.x, y: item.y, scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      style={{
        width: item.w,
        height: item.h,
        position: 'absolute',
        zIndex: item.zIndex,
      }}
      className="group cursor-grab active:cursor-grabbing flex items-center justify-center text-7xl drop-shadow-xl"
    >
      {item.text}

      <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          className="p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur-md shadow-sm"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  )
}
