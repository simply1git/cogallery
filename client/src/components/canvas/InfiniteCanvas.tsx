import { useRef, useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { DraggablePhoto } from './DraggablePhoto'
import { StickyNote } from './StickyNote'
import { DraggableEmoji } from './DraggableEmoji'
import { CanvasItem, CanvasCursor } from '@/hooks/useMoodboardSync'
import { MousePointer2 } from 'lucide-react'

interface InfiniteCanvasProps {
  items: Record<string, CanvasItem>
  cursors: Record<string, CanvasCursor>
  updateItem: (item: CanvasItem) => void
  deleteItem: (id: string) => void
  updateCursor: (x: number, y: number) => void
  isLoading: boolean
  onPhotoDoubleClick?: (photoId: string) => void
}

export function InfiniteCanvas({ items, cursors, updateItem, deleteItem, updateCursor, isLoading, onPhotoDoubleClick }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Custom pan state
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  
  const springConfig = { stiffness: 400, damping: 40 }
  const animatedX = useSpring(x, springConfig)
  const animatedY = useSpring(y, springConfig)
  const animatedScale = useSpring(scale, springConfig)

  const [topZIndex, setTopZIndex] = useState(1)

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomDelta = -e.deltaY * 0.002
        const newScale = Math.min(Math.max(scale.get() + zoomDelta, 0.1), 5)
        scale.set(newScale)
      } else {
        // Pan
        x.set(x.get() - e.deltaX)
        y.set(y.get() - e.deltaY)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handlePointerMove = (e: React.PointerEvent) => {
    // Calculate cursor position relative to the canvas origin (0,0), taking scale and pan into account
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // Reverse the pan and scale to get true board coordinates
    const boardX = (e.clientX - rect.left - x.get()) / scale.get()
    const boardY = (e.clientY - rect.top - y.get()) / scale.get()
    
    updateCursor(boardX, boardY)
  }

  if (isLoading) {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-zinc-500 animate-pulse">Loading canvas...</div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#0a0a0a] overflow-hidden relative cursor-crosshair"
      onPointerMove={handlePointerMove}
    >
      {/* Background grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* The actual canvas plane */}
      <motion.div
        style={{
          x: animatedX,
          y: animatedY,
          scale: animatedScale,
          transformOrigin: '0 0',
          width: 0,
          height: 0
        }}
        className="relative"
      >
        {/* Render items */}
        {Object.values(items).map(item => {
          if (item.type === 'sticky') {
            return (
              <StickyNote
                key={item.id}
                item={item}
                onChange={updateItem}
                onDelete={deleteItem}
                onBringToFront={() => {
                  setTopZIndex(z => z + 1)
                  updateItem({ ...item, zIndex: topZIndex + 1 })
                }}
              />
            )
          }

          if (item.type === 'emoji') {
            return (
              <DraggableEmoji
                key={item.id}
                item={item}
                onChange={updateItem}
                onDelete={deleteItem}
                onBringToFront={() => {
                  setTopZIndex(z => z + 1)
                  updateItem({ ...item, zIndex: topZIndex + 1 })
                }}
              />
            )
          }

          return (
            <DraggablePhoto
              key={item.id}
              item={item}
              onChange={updateItem}
              onDelete={deleteItem}
              onBringToFront={() => {
                setTopZIndex(z => z + 1)
                updateItem({ ...item, zIndex: topZIndex + 1 })
              }}
              onDoubleClick={onPhotoDoubleClick}
            />
          )
        })}

        {/* Render multiplayer cursors */}
        {Object.values(cursors).map(cursor => (
          <motion.div
            key={cursor.userId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: cursor.x, y: cursor.y }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
            className="absolute z-50 pointer-events-none flex items-center"
            style={{ transform: `translate(-2px, -2px)` }}
          >
            <MousePointer2 
              size={18} 
              fill={cursor.color} 
              color="white" 
              className="drop-shadow-md"
              style={{ transform: 'rotate(-15deg)' }}
            />
            <div 
              className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName || 'Anon'}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-6 right-6 flex gap-2">
        <button 
          onClick={() => scale.set(scale.get() * 1.2)}
          className="w-10 h-10 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full backdrop-blur flex items-center justify-center shadow-lg"
        >
          +
        </button>
        <button 
          onClick={() => scale.set(scale.get() * 0.8)}
          className="w-10 h-10 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full backdrop-blur flex items-center justify-center shadow-lg"
        >
          -
        </button>
        <button 
          onClick={() => { x.set(0); y.set(0); scale.set(1) }}
          className="px-4 h-10 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full backdrop-blur flex items-center justify-center shadow-lg text-sm font-medium"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
