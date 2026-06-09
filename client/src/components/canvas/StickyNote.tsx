import { useEffect, useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { CanvasItem } from '@/hooks/useMoodboardSync'
import { Trash2 } from 'lucide-react'

interface StickyNoteProps {
  item: CanvasItem
  onChange: (item: CanvasItem) => void
  onDelete: (id: string) => void
  onBringToFront: () => void
}

export function StickyNote({ item, onChange, onDelete, onBringToFront }: StickyNoteProps) {
  const controls = useDragControls()
  const [text, setText] = useState(item.text || '')

  useEffect(() => {
    setText(item.text || '')
  }, [item.text])

  const handleBlur = () => {
    if (text !== item.text) {
      onChange({ ...item, text })
    }
  }

  // A glassmorphism/aesthetic aesthetic color mapping
  const bgColors = {
    yellow: 'bg-yellow-400/80 text-yellow-950 border-yellow-300',
    blue: 'bg-blue-400/80 text-blue-950 border-blue-300',
    pink: 'bg-pink-400/80 text-pink-950 border-pink-300',
    green: 'bg-emerald-400/80 text-emerald-950 border-emerald-300'
  }
  
  const colorClass = bgColors[(item.color as keyof typeof bgColors)] || bgColors.yellow

  const [isResizing, setIsResizing] = useState(false)

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startW = item.w
    const startH = item.h

    const onPointerMove = (moveEvent: PointerEvent) => {
      const newW = Math.max(100, startW + (moveEvent.clientX - startX))
      const newH = Math.max(100, startH + (moveEvent.clientY - startY))

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
      onDragEnd={(_, info) => {
        if (isResizing) return
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
      className={`group rounded-xl shadow-2xl backdrop-blur-md border ${colorClass} cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-white/50 transition-shadow p-4 flex flex-col`}
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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onPointerDownCapture={(e) => e.stopPropagation()} // Allow clicking inside to type without dragging
        placeholder="Type a note..."
        className="w-full h-full bg-transparent resize-none outline-none font-medium text-sm leading-relaxed placeholder:text-black/30"
      />

      {/* Resize Handle */}
      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end justify-end p-1"
      >
        <div className="w-3 h-3 bg-black/20 rounded-tl-sm rounded-br-lg shadow-sm" />
      </div>
    </motion.div>
  )
}
