import { create } from 'zustand'
import type { Photo } from '@/types'

interface CanvasStore {
  photos: Photo[]
  setPhotos: (photos: Photo[]) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  photos: [],
  setPhotos: (photos) => set({ photos }),
}))
