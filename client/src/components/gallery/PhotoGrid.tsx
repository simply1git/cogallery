import { useRef, useMemo, useEffect } from 'react'
import { PhotoCard } from './PhotoCard'
import type { Photo } from '@/types'
import { useHaptics } from '@/hooks/useHaptics'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

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

type RowItem = 
  | { type: 'header'; title: string }
  | { type: 'photos'; items: Photo[]; startIndex: number }

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
  const { haptic } = useHaptics()
  const observerTarget = useRef<HTMLDivElement>(null)

  // Infinite Scroll Trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
          onLoadMore()
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, onLoadMore])

  // Process photos into grouped rows (4 columns for desktop, 3 for tablet, 2 for mobile)
  const columns = typeof window !== 'undefined' && window.innerWidth < 640 ? 2 : typeof window !== 'undefined' && window.innerWidth < 1024 ? 3 : 4;

  const rows = useMemo(() => {
    const result: RowItem[] = []
    if (!photos.length) return result

    let currentGroup = ''
    let currentPhotoRow: Photo[] = []
    let currentStartIndex = 0

    photos.forEach((photo, index) => {
      const date = new Date(photo.takenAt || photo.createdAt)
      const group = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      if (group !== currentGroup) {
        // Flush existing row if any
        if (currentPhotoRow.length > 0) {
          result.push({ type: 'photos', items: currentPhotoRow, startIndex: currentStartIndex })
          currentPhotoRow = []
        }
        // Add new header
        result.push({ type: 'header', title: group })
        currentGroup = group
      }

      if (currentPhotoRow.length === 0) {
        currentStartIndex = index
      }

      currentPhotoRow.push(photo)

      if (currentPhotoRow.length === columns) {
        result.push({ type: 'photos', items: currentPhotoRow, startIndex: currentStartIndex })
        currentPhotoRow = []
      }
    })

    if (currentPhotoRow.length > 0) {
      result.push({ type: 'photos', items: currentPhotoRow, startIndex: currentStartIndex })
    }

    return result
  }, [photos, columns])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) => {
      const row = rows[index]
      // Assume square photos, width = window.innerWidth / columns. Add gap.
      return row.type === 'header' ? 60 : (typeof window !== 'undefined' ? (window.innerWidth / columns) + 16 : 200)
    },
    overscan: 5,
  })

  if (isLoading && photos.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white/[0.05] animate-pulse aspect-square" />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = rows[virtualItem.index]

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-2"
            >
              {row.type === 'header' ? (
                <div className="flex items-center h-full">
                  <h2 className="text-lg font-semibold text-zinc-100 px-2">{row.title}</h2>
                </div>
              ) : (
                <div 
                  className="grid gap-4 w-full h-full pb-4" 
                  style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                  {row.items.map((photo, localIndex) => {
                    const globalIndex = row.startIndex + localIndex
                    return (
                      <div key={photo.id} className="w-full h-full">
                        <PhotoCard
                          photo={photo}
                          onClick={() => onPhotoClick?.(photo, globalIndex)}
                          onDelete={() => onPhotoDelete?.(photo)}
                          canDelete={canDelete?.(photo) ?? false}
                          selectable={selectedIds !== undefined}
                          selected={selectedIds?.has(photo.id)}
                          onSelect={() => onToggleSelect?.(photo.id)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Infinite Scroll Trigger */}
      <div ref={observerTarget} className="h-10 w-full mt-4 flex items-center justify-center">
        {isLoadingMore && <div className="w-6 h-6 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin-slow" />}
      </div>
    </div>
  )
}