import { PhotoCard } from './PhotoCard'
import type { Photo } from '@/types'
import { Masonry } from 'masonic'

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
    <Masonry
      items={photos}
      columnGutter={16}
      columnWidth={200}
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
  )
}
