import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { listPhotos } from '@/services/photoService'
import { usePhotoSubscription } from '@/hooks/realtime/usePhotoSubscription'
import type { Photo } from '@/types'

interface UseEventPhotosOptions {
  eventId?: string
  filter?: 'all' | 'image' | 'video'
  uploaderFilter?: string
  userId?: string
}

export function useEventPhotos({ eventId, filter, uploaderFilter, userId }: UseEventPhotosOptions) {
  const queryClient = useQueryClient()
  
  const queryKey = ['photos', eventId, filter, uploaderFilter]

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const { data, hasMore } = await listPhotos({
        eventId: eventId!,
        mediaType: filter === 'all' ? undefined : filter,
        uploaderId: uploaderFilter === 'all' ? undefined : uploaderFilter,
        page: pageParam,
        pageSize: 50,
      })
      return { data, hasMore, nextPage: pageParam + 1 }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: !!eventId,
  })

  const photos = data?.pages.flatMap((page) => page.data) || []

  // Hook into realtime updates and update the cache locally
  usePhotoSubscription({
    eventId: eventId!,
    onNewPhoto: (photo) => {
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData
        const firstPage = oldData.pages[0]
        
        // Prevent duplicates
        const exists = oldData.pages.some((p: any) => p.data.find((x: Photo) => x.id === photo.id))
        
        if (exists) {
            // Update existing photo
            return {
                ...oldData,
                pages: oldData.pages.map((p: any) => ({
                    ...p,
                    data: p.data.map((x: Photo) => x.id === photo.id ? photo : x)
                }))
            }
        }
        
        return {
          ...oldData,
          pages: [
            { ...firstPage, data: [photo, ...firstPage.data] },
            ...oldData.pages.slice(1),
          ],
        }
      })
    },
    onPhotoDeleted: (photoId) => {
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          pages: oldData.pages.map((p: any) => ({
            ...p,
            data: p.data.filter((x: Photo) => x.id !== photoId),
          })),
        }
      })
    },
  })

  const imageCount = photos.filter((p) => p.mediaType === 'image').length
  const videoCount = photos.filter((p) => p.mediaType === 'video').length
  const totalSize = photos.reduce((acc, p) => acc + (p.fileSizeBytes || 0), 0)

  return {
    photos,
    isLoadingPhotos: isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMore: fetchNextPage,
    imageCount,
    videoCount,
    totalSize
  }
}
