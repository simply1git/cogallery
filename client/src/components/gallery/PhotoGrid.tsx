import { useState, useEffect, useRef, useDeferredValue, startTransition } from 'react'
import { PhotoCard } from './PhotoCard'
import type { Photo } from '@/types'
import { useHaptics } from '@/hooks/useHaptics'



interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo, index: number) => void
  onPhotoDelete?: (photo: Photo) => void
  canDelete?: (photo: Photo) => boolean
  isLoading?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photoId: string) => void
  activePhotoId?: string
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  onPhotoDelete,
  canDelete,
  isLoading,
  selectedIds,
  onToggleSelect,
  hasMore,
  isLoadingMore,
  onLoadMore,
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
        
        startTransition(() => {
          setColWidth(newWidth)
        })
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

  const deferredColWidth = useDeferredValue(colWidth)

  // Intersection Observer for Infinite Scroll
  // IMPORTANT: These hooks MUST be above any early returns to satisfy React's Rules of Hooks.
  const observerTarget = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
          onLoadMore()
        }
      },
      { threshold: 0.1, rootMargin: '400px' } // Pre-fetch before scrolling completely to bottom
    )
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }
    
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, onLoadMore])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white/[0.05] animate-pulse aspect-square"
          />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return null
  }

    <div className="w-full">
      <div 
        ref={containerRef} 
        className="w-full touch-pan-y grid gap-4" 
        style={{ 
          willChange: 'transform',
          gridTemplateColumns: `repeat(auto-fill, minmax(${deferredColWidth}px, 1fr))` 
        }}
      >
        {photos.map((data, index) => (
          <PhotoCard
            key={data.id}
            photo={data}
            onClick={() => onPhotoClick?.(data, index)}
            onDelete={() => onPhotoDelete?.(data)}
            canDelete={canDelete?.(data) ?? false}
            selectable={selectedIds !== undefined}
            selected={selectedIds?.has(data.id)}
            onSelect={() => onToggleSelect?.(data.id)}
          />
        ))}
      </div>
      
      {/* Infinite Scroll Sentinel */}
      {hasMore && (
        <div ref={observerTarget} className="w-full py-8 flex justify-center">
          {isLoadingMore && (
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
      )}
    </div>
}
