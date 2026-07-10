// Virtualized Photo Grid for efficient rendering of large photo collections
// Uses windowing technique to only render visible items

import { useState, useEffect, useRef, RefObject } from 'react';
import type { Photo } from '@/types';
import { PhotoCard } from './PhotoCard';

interface VirtualPhotoGridProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onPhotoDelete?: (photo: Photo) => void;
  canDelete?: (photo: Photo) => boolean | undefined;
  isLoading?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photoId: string) => void;
  activePhotoId?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  // Virtualization props
  itemHeight?: number; // Fixed height for items (if null, will be measured)
  overscan?: number; // Number of extra items to render above/below viewport
}

export function VirtualPhotoGrid({
  photos,
  onPhotoClick,
  onPhotoDelete,
  canDelete,
  isLoading,
  selectedIds,
  onToggleSelect,
  activePhotoId,
  hasMore,
  isLoadingMore,
  onLoadMore,
  itemHeight = 200, // Default item height
  overscan = 3, // Render 3 extra items on each side
}: VirtualPhotoGridProps) {
  const [virtualStart, setVirtualStart] = useState(0);
  const [virtualStop, setVirtualStop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Calculate visible range based on scroll position
  useEffect(() => {
    if (!containerRef.current) return;

    const updateVisibleRange = () => {
      const container = containerRef.current;
      if (!container) return;

      const offset = container.scrollTop || 0;
      const visibleStart = Math.max(0, Math.floor(offset / itemHeight) - overscan);
      const visibleEnd = Math.min(
        photos.length,
        Math.ceil((offset + container.clientHeight) / itemHeight) + overscan
      );

      setVirtualStart(visibleStart);
      setVirtualStop(visibleEnd);
    };

    // Initial calculation
    updateVisibleRange();

    // Listen for scroll events
    containerRef.current.addEventListener('scroll', updateVisibleRange);

    // Cleanup
    return () => {
      containerRef.current?.removeEventListener('scroll', updateVisibleRange);
    };
  }, [photos.length, itemHeight, overscan]);

  // Handle resize observations for dynamic item heights
  useEffect(() => {
    if (!measurementRef.current) return;

    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === measurementRef.current) {
          // If we have measured height, update itemHeight
          const measuredHeight = Math.round(entry.contentRect.height);
          if (measuredHeight > 0 && measuredHeight !== itemHeight) {
            // Note: This would trigger a re-render with new itemHeight
            // In practice, you might want to debounce this or use a different approach
            // For simplicity, we're assuming fixed height items
          }
        }
      }
    });

    if (measurementRef.current) {
      resizeObserverRef.current.observe(measurementRef.current);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [itemHeight]);

  // Calculate total height for scroll container
  const totalHeight = photos.length * itemHeight;

  // Get visible items
  const visiblePhotos = photos.slice(virtualStart, virtualStop);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-auto"
      style={{ height: 'calc(100vh - 200px)' }} // Adjust based on your layout
    >
      {/* Spacer above to maintain scroll height */}
      <div
        style={{
          height: virtualStart * itemHeight,
          width: '100%',
        }}
      />

      {/* Virtualized list */}
      <div
        style={{
          position: 'relative',
          top: `${virtualStart * itemHeight}px`,
          height: `${(virtualStop - virtualStart) * itemHeight}px`,
        }}
      >
        {visiblePhotos.map((photo, index) => {
          const actualIndex = virtualStart + index;
          return (
            <div
              key={photo.id}
              style={{
                position: 'absolute',
                top: `${index * itemHeight}px`,
                left: 0,
                width: '100%',
                height: `${itemHeight}px`,
              }}
            >
              <PhotoCard
                photo={photo}
                onClick={() => onPhotoClick?.(photo)}
                onDelete={() => onPhotoDelete?.(photo)}
                canDelete={canDelete ? !!canDelete(photo) : undefined}
                selectable={!!selectedIds}
                selected={selectedIds?.has(photo.id) || false}
                onSelect={onToggleSelect ? () => onToggleSelect(photo.id) : undefined}
              />
            </div>
          );
        })}

        {/* Loading indicator at the end if loading more */}
        {isLoadingMore && hasMore && (
          <div
            style={{
              position: 'absolute',
              top: `${(virtualStop - virtualStart) * itemHeight}px`,
              left: 0,
              width: '100%',
              height: `${itemHeight}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div className="animate-spin rounded-full border-b-2 border-solid border-blue-500 w-8 h-8" />
          </div>
        )}
      </div>

      {/* Spacer below to maintain scroll height */}
      <div
        style={{
          height: (photos.length - virtualStop) * itemHeight,
          width: '100%',
        }}
      />

      {/* Show loading spinner at bottom if loading more items */}
      {isLoading && !hasMore && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full border-b-2 border-solid border-blue-500 w-8 h-8" />
        </div>
      )}

      {/* Show message when no photos */}
      {photos.length === 0 && !isLoading && (
        <div className="flex items-center justify-center py-12 text-center">
          <p className="text-zinc-500">No photos to display</p>
        </div>
      )}
    </div>
  );
}