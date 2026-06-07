import { create } from 'zustand'
import type { Room, RoomWithMembers } from '@/types'

interface RoomStore {
  rooms: RoomWithMembers[]
  currentRoom: RoomWithMembers | null
  isLoading: boolean
  error: string | null

  setRooms: (rooms: RoomWithMembers[]) => void
  setCurrentRoom: (room: RoomWithMembers | null) => void
  addRoom: (room: Room) => void
  updateRoom: (roomId: string, updates: Partial<Room>) => void
  removeRoom: (roomId: string) => void
  vaultKeys: Record<string, CryptoKey>
  setVaultKey: (roomId: string, key: CryptoKey) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  rooms: [],
  currentRoom: null,
  isLoading: false,
  error: null,
  vaultKeys: {},

  setVaultKey: (roomId, key) =>
    set((state) => ({
      vaultKeys: { ...state.vaultKeys, [roomId]: key },
    })),

  setRooms: (rooms) => set({ rooms }),

  setCurrentRoom: (room) => set({ currentRoom: room }),

  addRoom: (room) =>
    set((state) => ({
      rooms: [
        { ...room, members: [], memberCount: 0, eventCount: 0, photoCount: 0 },
        ...state.rooms,
      ],
    })),

  updateRoom: (roomId, updates) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, ...updates } : r
      ),
      currentRoom:
        state.currentRoom?.id === roomId
          ? { ...state.currentRoom, ...updates }
          : state.currentRoom,
    })),

  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({ rooms: [], currentRoom: null, isLoading: false, error: null }),
}))
