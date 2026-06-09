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
  isDrawingMode?: boolean
}

export function InfiniteCanvas({ items, cursors, updateItem, deleteItem, updateCursor, isLoading, onPhotoDoubleClick, isDrawingMode }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Custom pan state
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useSpring(1, { stiffness: 300, damping: 30 })

  const [topZIndex, setTopZIndex] = useState(0)
  const [currentPath, setCurrentPath] = useState<number[][]>([])
  
  useEffect(() => {
    let maxZ = 0
    Object.values(items).forEach(item => {
      if (item.zIndex > maxZ) maxZ = item.zIndex
    })
    setTopZIndex(maxZ)
  }, [items])

  // Get pointer position relative to the scaled/panned canvas
  const getCanvasPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    
    // Reverse the pan and zoom
    const normalizedX = (clientX - rect.left - x.get()) / scale.get()
    const normalizedY = (clientY - rect.top - y.get()) / scale.get()
    return { x: normalizedX, y: normalizedY }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDrawingMode) {
      e.stopPropagation()
      const pt = getCanvasPoint(e.clientX, e.clientY)
      setCurrentPath([[pt.x, pt.y]])
      return
    }

    // Normal pan interaction (middle click or spacebar equivalent)
    if (e.button === 1 || e.button === 2) {
      // Middle or right click
      e.preventDefault()
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const pt = getCanvasPoint(e.clientX, e.clientY)
    updateCursor(pt.x, pt.y)

    if (isDrawingMode && e.buttons === 1) {
      setCurrentPath(prev => [...prev, [pt.x, pt.y]])
    }
  }

  const handlePointerUp = () => {
    if (isDrawingMode && currentPath.length > 0) {
      const pathString = `M ${currentPath.map(p => `${p[0]} ${p[1]}`).join(' L ')}`
      updateItem({
        id: `path-${Date.now()}`,
        type: 'path',
        pathData: pathString,
        strokeColor: '#3b82f6', // default blue
        strokeWidth: 4,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        zIndex: topZIndex + 1
      })
      setCurrentPath([])
    }
  }

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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
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
          x,
          y,
          scale,
          transformOrigin: '0 0',
          width: 0,
          height: 0
        }}
        className="relative"
      >
        {/* Render items */}
        {Object.values(items).map(item => {
          if (item.type === 'path' && item.pathData) {
            return (
              <svg 
                key={item.id} 
                className="absolute overflow-visible pointer-events-none"
                style={{ zIndex: item.zIndex, left: 0, top: 0 }}
              >
                <path
                  d={item.pathData}
                  stroke={item.strokeColor || '#3b82f6'}
                  strokeWidth={item.strokeWidth || 4}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          }
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

        {/* Render current drawing path */}
        {currentPath.length > 0 && (
          <svg className="absolute overflow-visible pointer-events-none" style={{ zIndex: topZIndex + 2, left: 0, top: 0 }}>
            <path
              d={`M ${currentPath.map(p => `${p[0]} ${p[1]}`).join(' L ')}`}
              stroke="#3b82f6"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

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
