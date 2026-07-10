import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingStore {
  hasSeenWelcome: boolean
  hasCreatedRoom: boolean
  hasUploadedFile: boolean
  hasCreatedEvent: boolean
  hasViewedGallery: boolean
  hasCompletedOnboarding: boolean

  setSeenWelcome: () => void
  setCreatedRoom: () => void
  setUploadedFile: () => void
  setCreatedEvent: () => void
  setViewedGallery: () => void
  setCompletedOnboarding: () => void

  resetOnboarding: () => void

  getCurrentStep: () => 'welcome' | 'roomCreation' | 'upload' | 'events' | 'gallery' | 'complete'
  getStepPercentage: () => number
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      hasSeenWelcome: false,
      hasCreatedRoom: false,
      hasUploadedFile: false,
      hasCreatedEvent: false,
      hasViewedGallery: false,
      hasCompletedOnboarding: false,

      setSeenWelcome: () => set({ hasSeenWelcome: true }),
      setCreatedRoom: () => set({ hasCreatedRoom: true }),
      setUploadedFile: () => set({ hasUploadedFile: true }),
      setCreatedEvent: () => set({ hasCreatedEvent: true }),
      setViewedGallery: () => set({ hasViewedGallery: true }),
      setCompletedOnboarding: () => set({ hasCompletedOnboarding: true }),

      resetOnboarding: () => set({
        hasSeenWelcome: false,
        hasCreatedRoom: false,
        hasUploadedFile: false,
        hasCreatedEvent: false,
        hasViewedGallery: false,
        hasCompletedOnboarding: false
      }),

      getCurrentStep: () => {
        const state = get()
        if (!state.hasSeenWelcome) return 'welcome'
        if (!state.hasCreatedRoom) return 'roomCreation'
        if (!state.hasUploadedFile) return 'upload'
        if (!state.hasCreatedEvent) return 'events'
        if (!state.hasViewedGallery) return 'gallery'
        if (!state.hasCompletedOnboarding) return 'complete'
        return 'complete' // Default to complete if all are seen
      },

      getStepPercentage: () => {
        const state = get()
        let completedSteps = 0
        if (state.hasSeenWelcome) completedSteps++
        if (state.hasCreatedRoom) completedSteps++
        if (state.hasUploadedFile) completedSteps++
        if (state.hasCreatedEvent) completedSteps++
        if (state.hasViewedGallery) completedSteps++
        if (state.hasCompletedOnboarding) completedSteps++

        return (completedSteps / 6) * 100
      }
    }),
    {
      name: 'cogallery-onboarding-storage'
    }
  )
)