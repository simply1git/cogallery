import { useState, useEffect, useRef } from 'react'
import { PhotoCard } from './PhotoCard'
import type { Photo } from '@/types'
import { MasonryScroller, usePositioner, useResizeObserver } from 'masonic'
import { useHaptics } from '@/hooks/useHaptics'
import { createContext, useContext, memo } from 'react'

const PhotoGridContext = createContext<{
  onPhotoClick?: (photo: Photo, index: number) => void
  onPhotoDelete?: (photo: Photo) => void
  canDelete?: (photo: Photo) => boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photoId: string) => void
  activePhotoId?: string
}>({})

const MasonicCard = memo(function MasonicCard({ data, index }: { data: Photo; index: number }) {
  const ctx = useContext(PhotoGridContext)
  return (
    <PhotoCard
      photo={data}
      onClick={() => ctx.onPhotoClick?.(data, index)}
      onDelete={() => ctx.onPhotoDelete?.(data)}
      canDelete={ctx.canDelete?.(data) ?? false}
      selectable={ctx.selectedIds !== undefined}
      selected={ctx.selectedIds?.has(data.id)}
      onSelect={() => ctx.onToggleSelect?.(data.id)}
    />
  )
})

function useWindowSize() {
  const [size, setSize] = useState([
    typeof window !== 'undefined' ? window.innerWidth : 1200,
    typeof window !== 'undefined' ? window.innerHeight : 800
  ])
  useEffect(() => {
    const onResize = () => setSize([window.innerWidth, window.innerHeight])
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo, index: number) => void
  onPhotoDelete?: (photo: Photo) => void
  canDelete?: (photo: Photo) => boolean
  isLoading?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photoId: string) => void
  activePhotoId?: string
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  onPhotoDelete,
  canDelete,
  isLoading,
  selectedIds,
  onToggleSelect,
  activePhotoId,
}: PhotoGridProps) {
  const [colWidth, setColWidth] = useState(200)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialDistance = useRef<number | null>(null)
  const initialWidth = useRef<number>(200)
  const { haptic } = useHaptics()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches)
        initialWidth.current = colWidth
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current) {
        e.preventDefault() // prevent scrolling while pinching
        const currentDistance = getDistance(e.touches)
        const scale = currentDistance / initialDistance.current
        
        let newWidth = initialWidth.current * scale
        // Clamp width between 100 (dense grid) and 400 (large photos)
        newWidth = Math.max(100, Math.min(newWidth, 400))
        
        // Add haptic feedback if we hit boundaries
        if ((newWidth === 100 && colWidth > 100) || (newWidth === 400 && colWidth < 400)) {
          haptic('light')
        }
        
        setColWidth(newWidth)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance.current = null
      }
    }

    // Use passive: false to allow e.preventDefault()
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [colWidth, haptic])

  const windowSize = useWindowSize()
  const positioner = usePositioner(
    { 
      width: containerRef.current?.offsetWidth ?? windowSize[0], 
      columnWidth: colWidth, 
      columnGutter: 16 
    },
    [photos.length, colWidth, windowSize[0]]
  )
  const resizeObserver = useResizeObserver(positioner)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white/[0.05] animate-pulse"
            style={{ height: `${[180, 240, 160, 280, 200, 220][i % 6]}px` }}
          />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return null
  }

  return (
    <PhotoGridContext.Provider value={{ onPhotoClick, onPhotoDelete, canDelete, selectedIds, onToggleSelect, activePhotoId }}>
      <div ref={containerRef} className="w-full touch-pan-y">
        <MasonryScroller
          positioner={positioner}
          resizeObserver={resizeObserver}
          containerRef={containerRef}
          items={photos}
          height={windowSize[1]}
          offset={containerRef.current?.offsetTop ?? 0}
          overscanBy={2}
          itemKey={(data) => data.id}
          render={MasonicCard}
        />
      </div>
    </PhotoGridContext.Provider>
  )
}
