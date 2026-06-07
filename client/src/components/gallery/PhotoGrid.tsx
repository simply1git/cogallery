import { useState, useEffect, useRef } from 'react'
import { PhotoCard } from './PhotoCard'
import type { Photo } from '@/types'
import { Masonry } from 'masonic'
import { useHaptics } from '@/hooks/useHaptics'

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo, index: number) => void
  onPhotoDelete?: (photo: Photo) => void
  canDelete?: (photo: Photo) => boolean
  isLoading?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photoId: string) => void
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  onPhotoDelete,
  canDelete,
  isLoading,
  selectedIds,
  onToggleSelect,
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
    <div ref={containerRef} className="w-full touch-pan-y">
      <Masonry
        items={photos}
        columnGutter={16}
        columnWidth={colWidth}
        overscanBy={2}
        render={({ data, index }) => (
          <PhotoCard
            photo={data}
            onClick={() => onPhotoClick?.(data, index)}
            onDelete={() => onPhotoDelete?.(data)}
            canDelete={canDelete?.(data) ?? false}
            selectable={selectedIds !== undefined}
            selected={selectedIds?.has(data.id)}
            onSelect={() => onToggleSelect?.(data.id)}
          />
        )}
      />
    </div>
  )
}
