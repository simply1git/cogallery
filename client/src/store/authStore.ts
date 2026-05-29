import { create } from 'zustand'
import { User } from '@/types'

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({
    user,
    isAuthenticated: user !== null,
    isLoading: false,
  }),
  logout: () => set({
    user: null,
    isAuthenticated: false,
  }),
}))
