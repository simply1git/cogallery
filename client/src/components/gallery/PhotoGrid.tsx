import { PhotoCard } from './PhotoCard'
import type { Photo } from '@/types'

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
      <div className="masonry-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="masonry-item skeleton"
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
    <div className="masonry-grid">
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick?.(photo, index)}
          onDelete={() => onPhotoDelete?.(photo)}
          canDelete={canDelete?.(photo) ?? false}
          selectable={selectedIds !== undefined}
          selected={selectedIds?.has(photo.id)}
          onSelect={() => onToggleSelect?.(photo.id)}
        />
      ))}
    </div>
  )
}
