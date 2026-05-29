import { create } from 'zustand'
import { Event, Photo } from '@/types'

interface EventStore {
  currentEvent: Event | null
  photos: Photo[]
  isLoading: boolean
  setEvent: (event: Event | null) => void
  addPhoto: (photo: Photo) => void
  removePhoto: (photoId: string) => void
  setPhotos: (photos: Photo[]) => void
  setLoading: (isLoading: boolean) => void
}

export const useEventStore = create<EventStore>((set) => ({
  currentEvent: null,
  photos: [],
  isLoading: true,
  setEvent: (event) => set({ currentEvent: event }),
  addPhoto: (photo) => set((state) => ({
    photos: [photo, ...state.photos],
  })),
  removePhoto: (photoId) => set((state) => ({
    photos: state.photos.filter(p => p.id !== photoId),
  })),
  setPhotos: (photos) => set({ photos }),
  setLoading: (isLoading) => set({ isLoading }),
}))
