import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useNavigate } from 'react-router-dom'
import { Open, PictureInPicture, Video } from 'lucide-react'

export function OnboardingTutorial() {
  const navigate = useNavigate()
  const {
    hasSeenWelcome,
    hasCreatedRoom,
    hasUploadedFile,
    hasCreatedEvent,
    hasViewedGallery,
    hasCompletedOnboarding,
    setSeenWelcome,
    setCreatedRoom,
    setUploadedFile,
    setCreatedEvent,
    setViewedGallery,
    setCompletedOnboarding,
    getCurrentStep,
    getStepPercentage
  } = useOnboardingStore()

  const [isInteractiveMode, setIsInteractiveMode] = useState(false)
  const highlightRef = useRef<HTMLElement | null>(null)

  // Start the onboarding flow when the component mounts
  useEffect(() => {
    if (!hasCompletedOnboarding && !hasSeenWelcome) {
      setSeenWelcome()
      // Start in interactive mode for action-based steps
      setIsInteractiveMode(true)
    }
  }, [hasCompletedOnboarding, hasSeenWelcome, setSeenWelcome])

  // If onboarding is complete, return null to not show anything
  if (hasCompletedOnboarding) {
    return null
  }

  // Determine which step to show
  const currentStep = getCurrentStep()

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay for non-interactive steps */}
      {!isInteractiveMode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-none"></div>
      )}

      {/* Interactive highlight for action-based steps */}
      {isInteractiveMode && highlightRef.current && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div className="absolute inset-0 pointer-events-none"
               style={{
                 outline: '2px solid rgba(59, 130, 246, 0.7)',
                 outlineOffset: '-2px',
                 'border-radius': 'inherit'
               }}
          >
            {typeof highlightRef.current === 'object' && highlightRef.current.getBoundingClientRect
              ? (
                <>
                  <div
                    className="absolute"
                    style={{
                      left: `${highlightRef.current.getBoundingClientRect().left + window.scrollX}px`,
                      top: `${highlightRef.current.getBoundingClientRect().top + window.scrollY}px`,
                      width: `${highlightRef.current.getBoundingClientRect().width}px`,
                      height: `${highlightRef.current.getBoundingClientRect().height}px`,
                    }}
                  />
                  <div className="absolute inset-0 -z-10 pointer-events-none"
                       style={{
                         background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), transparent 0%, rgba(0,0,0,0.6) 70%)',
                         '-webkit-mask': 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), transparent 0%, black 70%)',
                         'mask': 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), transparent 0%, black 70%)'
                       }}
                  />
                </>
              ) : null}
        </div>
      )}

      <div className="pointer-events-all">
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-2xl mx-4">
            {/* Background overlay */}
            <div className="absolute inset-0 bg-black/70 rounded-2xl pointer-events-none" />

            {/* Content container */}
            <div className="relative z-10 bg-[#09090b]/85 border border-white/10 rounded-2xl p-8 space-y-6 max-w-4xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-[#f4f4f5] flex items-center space-x-3">
                  <span className="w-6 h-6 bg-gradient-to-r from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {getCurrentStepNumber()}
                  </span>
                  CoGallery Tour
                </h2>
                <button
                  onClick={() => {
                    setCompletedOnboarding()
                  }}
                  className="text-sm text-[#71717a] hover:text-white transition-colors hover:bg-white/10 rounded px-3 py-1"
                >
                  Skip
                  </button>
              </div>

              {/* Progress Bar */}
              <div className="flex w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-blue-500 to-violet-600 transition-all duration-500`}
                  style={{ width: `${getStepPercentage()}%` }}
                />
              </div>

              {/* Step Content */}
              <div className="text-center space-y-5">
                {getStepContent(currentStep, {
                  setSeenWelcome,
                  setCreatedRoom,
                  setUploadedFile,
                  setCreatedEvent,
                  setViewedGallery,
                  setCompletedOnboarding,
                  setIsInteractiveMode,
                  highlightRef,
                  navigate
                })}
              </div>

              {/* Navigation */}
              {currentStep !== 'complete' && (
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      handleNextStep(currentStep, {
                        setSeenWelcome,
                        setCreatedRoom,
                        setUploadedFile,
                        setCreatedEvent,
                        setViewedGallery,
                        setCompletedOnboarding,
                        setIsInteractiveMode
                      })
                    }}
                    className="btn-primary px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    disabled={isNextStepDisabled(currentStep)}
                  >
                    {getNextStepButtonText(currentStep)}
                  </button>
                </div>
              )}

              {currentStep === 'complete' && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setCompletedOnboarding()}
                    className="btn-primary px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to get current step number (1-5)
function getCurrentStepNumber(): number {
  const step = getCurrentStep()
  switch (step) {
    case 'welcome': return 1
    case 'roomCreation': return 2
    case 'upload': return 3
    case 'events': return 4
    case 'gallery': return 5
    case 'complete': return 5
    default: return 1
  }
}

// Helper function to get next step button text
function getNextStepButtonText(step: string): string {
  switch (step) {
    case 'welcome': return 'Get Started'
    case 'roomCreation': return 'Next'
    case 'upload': return 'Next'
    case 'events': return 'Next'
    case 'gallery': return 'Finish Tour'
    default: return 'Next'
  }
}

// Helper function to determine if next step should be disabled
function isNextStepDisabled(step: string): boolean {
  // For interactive steps, we disable the button until the action is completed
  const state = useOnboardingStore.getState()
  switch (step) {
    case 'roomCreation': return !state.hasCreatedRoom
    case 'upload': return !state.hasUploadedFile
    case 'events': return !state.hasCreatedEvent
    case 'gallery': return !state.hasViewedGallery
    default: return false
  }
}

// Handle advancing to next step
function handleNextStep(
  currentStep: string,
  {
    setSeenWelcome,
    setCreatedRoom,
    setUploadedFile,
    setCreatedEvent,
    setViewedGallery,
    setCompletedOnboarding,
    setIsInteractiveMode
  }: {
    setSeenWelcome: () => void
    setCreatedRoom: () => void
    setUploadedFile: () => void
    setCreatedEvent: () => void
    setViewedGallery: () => void
    setCompletedOnboarding: () => void
    setIsInteractiveMode: (mode: boolean) => void
  }
) {
  switch (currentStep) {
    case 'welcome':
      setCreatedRoom(false) // Reset room creation flag
      setIsInteractiveMode(true) // Enter interactive mode for room creation
      break
    case 'roomCreation':
      setUploadedFile(false) // Reset upload flag
      setIsInteractiveMode(true) // Enter interactive mode for upload
      break
    case 'upload':
      setCreatedEvent(false) // Reset event creation flag
      setIsInteractiveMode(true) // Enter interactive mode for event creation
      break
    case 'events':
      setViewedGallery(false) // Reset gallery view flag
      setIsInteractiveMode(true) // Enter interactive mode for gallery viewing
      break
    case 'gallery':
      setCompletedOnboarding()
      setIsInteractiveMode(false)
      break
    default:
      setIsInteractiveMode(false)
      break
  }
}

function getStepContent(
  step: string,
  {
    setSeenWelcome,
    setCreatedRoom,
    setUploadedFile,
    setCreatedEvent,
    setViewedGallery,
    setCompletedOnboarding,
    setIsInteractiveMode,
    highlightRef,
    navigate
  }: {
    setSeenWelcome: () => void
    setCreatedRoom: () => void
    setUploadedFile: () => void
    setCreatedEvent: () => void
    setViewedGallery: () => void
    setCompletedOnboarding: () => void
    setIsInteractiveMode: (mode: boolean) => void
    highlightRef: React.MutableRefObject<HTMLElement | null>
    navigate: (to: string) => void
  }
) {
  switch (step) {
    case 'welcome':
      return (
        <>
          <div className="text-5xl font-black mb-4">
            01
          </div>
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">
            Welcome to CoGallery
          </h3>
          <p className="text-[#a1a1aa] max-w-xl">
            Discover how to preserve your memories in original quality, collaborate
            with friends and family, and enjoy your photos and videos forever—
            without compression, without limits, without expiry.
          </p>
          <div className="mt-6 flex items-center justify-center space-x-4">
            <div className="w-4 h-4 bg-blue-500 rounded-full" />
            <span className="text-sm text-[#71717a]">Your journey starts here</span>
          </div>
        </>
      )

    case 'roomCreation':
      return (
        <>
          <div className="text-5xl font-black mb-4">
            02
          </div>
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">
            Create Your First Room
          </h3>
          <p className="text-[#a1a1aa] max-w-xl">
            Click the "+ New Room" button below to create your first space for
            organizing photos and videos.
          </p>
          {/* Point to the actual New Room button */}
          <div className="mt-8 relative">
            <div
              ref={highlightRef}
              id="create-room-btn"
              className="inline-block"
            >
              {/* We'll try to detect if we're on the dashboard page and highlight the actual button */}
              <div className="absolute inset-0 pointer-events-none"
                   style={{
                     pointerEvents: 'none',
                     position: 'absolute',
                     top: 0,
                     left: 0,
                     right: 0,
                     bottom: 0
                   }}
              />
            </div>
          </div>
          <p className="mt-4 text-sm text-[#a1a1aa]">
            The button is highlighted above. Click it to continue.
          </p>
          <div className="mt-6">
            {/* Fallback button for when not on dashboard */}
            <button
              onClick={() => {
                setCreatedRoom(true)
                setIsInteractiveMode(false)
              }}
              className="btn-primary px-6 py-3 w-full"
            >
              Simulate Creating Room
            </button>
          </div>
        </>
      )

    case 'upload':
      return (
        <>
          <div className="text-5xl font-black mb-4">
            03
          </div>
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">
            Upload Your Memories
          </h3>
          <p className="text-[#a1a1aa] max-w-xl">
            Drag and drop photos and videos of any size, or click to browse.
            Your files are preserved in original quality with zero compression.
          </p>
          {/* Point to the upload zone */}
          <div className="mt-6 relative">
            <div
              ref={highlightRef}
              id="upload-zone"
              className="inline-block"
            >
              {/* Visual indicator for upload zone */}
              <div className="relative overflow-hidden rounded-xl bg-white/10 h-48">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center space-x-2 text-[#71717a]">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                      +
                    </div>
                    <span>Click or drag files to upload</span>
                  </div>
                  <p className="text-xs text-[#71717a]">
                    Supports photos, videos, and all file types • Original quality preserved
                  </p>
                </div>
                <div className="absolute inset-0 animate-pulse bg-green-500/10" />
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-[#a1a1aa]">
            The upload zone is highlighted above. Try uploading a file to continue.
          </p>
          <div className="mt-6">
            {/* Fallback simulated upload */}
            <button
              onClick={() => {
                setUploadedFile(true)
                setIsInteractiveMode(false)
              }}
              className="btn-primary px-6 py-3 w-full"
            >
              Simulate File Upload
            </button>
          </div>
        </>
      )

    case 'events':
      return (
        <>
          <div className="text-5xl font-black mb-4">
            04
          </div>
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">
            Organize with Events
          </h3>
          <p className="text-[#a1a1aa] max-w-xl">
            Break your room into days, themes, or activities using Events.
            Create your first event to organize your memories.
          </p>
          {/* Point to where events would be created */}
          <div className="mt-6 relative">
            <div
              ref={highlightRef}
              id="event-creator"
              className="inline-block"
            >
              {/* Placeholder for event creation UI */}
              <div className="relative overflow-hidden rounded-xl bg-white/10 h-48">
                <div className="absolute inset-0 grid grid-cols-2 gap-4 p-4">
                  <div className="bg-white/10 rounded-lg border border-white/5">
                    <div className="flex items-center space-x-3 p-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-[18px]">📅</span>
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium">Day 1:</p>
                        <p className="text-xs text-[#a1a1aa]">No events yet</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg border border-white/5">
                    <div className="flex items-center space-x-3 p-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-[18px]">+</span>
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium">Create Event</p>
                        <p className="text-xs text-[#a1a1aa]">Click to add your first event</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 animate-pulse bg-purple-500/10" />
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-[#a1a1aa]">
            The event creation area is highlighted above. Create an event to continue.
          </p>
          <div className="mt-6">
            {/* Fallback simulated event creation */}
            <button
              onClick={() => {
                setCreatedEvent(true)
                setIsInteractiveMode(false)
              }}
              className="btn-primary px-6 py-3 w-full"
            >
              Simulate Creating Event
            </button>
          </div>
        </>
      )

    case 'gallery':
      return (
        <>
          <div className="text-5xl font-black mb-4">
            05
          </div>
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">
            Explore Your Gallery
          </h3>
          <p className="text-[#a1a1aa] max-w-xl">
            View your memories in the gallery to see them beautifully organized.
            Navigate to any room to see your photos and videos.
          </p>
          {/* Point to the rooms grid */}
          <div className="mt-6 relative">
            <div
              ref={highlightRef}
              id="rooms-grid"
              className="inline-block"
            >
              {/* Visual indicator for rooms grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div
                  className="rounded-xl border-2 border-dashed border-white/[0.08] p-8 flex flex-col items-center gap-3 text-[#71717a] hover:text-[#a1a1aa] hover:border-white/[0.15] transition-all duration-200 group">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.15] transition-colors">
                    <Open className="text-blue-400" />
                  </div>
                  <span className="text-sm font-medium">Your Rooms</span>
                </div>
                {/* Add a couple more placeholder grids */}
                <div
                  className="rounded-xl border-2 border-dashed border-white/[0.08] p-8 flex flex-col items-center gap-3 text-[#71717a] hover:text-[#a1a1aa] hover:border-white/[0.15] transition-all duration-200 group">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.15] transition-colors">
                    <PictureInPicture className="text-purple-400" />
                  </div>
                  <span className="text-sm font-medium">Room 2</span>
                </div>
                <div
                  className="rounded-xl border-2 border-dashed border-white/[0.08] p-8 flex flex-col items-center gap-3 text-[#71717a] hover:text-[#a1a1aa] hover:border-white/[0.15] transition-all duration-200 group">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.15] transition-colors">
                    <Video className="text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium">Room 3</span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-[#a1a1aa]">
            The rooms grid is highlighted above. Navigate to a room to continue.
          </p>
          <div className="mt-6">
            {/* Fallback simulated gallery view */}
            <button
              onClick={() => {
                setViewedGallery(true)
                setIsInteractiveMode(false)
              }}
              className="btn-primary px-6 py-3 w-full"
            >
              Simulate Viewing Gallery
            </button>
          </div>
        </>
      )

    case 'complete':
      return (
        <>
          <div className="text-5xl font-black mb-4">
            05
          </div>
          <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">
            You're All Set!
          </h3>
          <p className="text-[#a1a1aa] max-w-xl">
            You've learned the basics of CoGallery. Start creating your first room
            and preserving your memories in perfect quality forever.
          </p>
          <div className="mt-6 flex items-center justify-center space-x-4">
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <span className="text-sm text-[#71717a]">Ready to create memories?</span>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-[#71717a]">
              Tip: You can always revisit the tutorial from Settings → Help & Support
            </p>
          </div>
        </>
      )

    default:
      return <p className="text-[#a1a1aa]">Loading tutorial...</p>
  }
}