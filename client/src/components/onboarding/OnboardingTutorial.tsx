import { useOnboardingStore } from '@/store/onboardingStore'

export function OnboardingTutorial() {
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
    setCompletedOnboarding
  } = useOnboardingStore()

  const getCurrentStep = () => {
    if (!hasSeenWelcome) return 'welcome'
    if (!hasCreatedRoom) return 'roomCreation'
    if (!hasUploadedFile) return 'upload'
    if (!hasCreatedEvent) return 'events'
    if (!hasViewedGallery) return 'gallery'
    if (!hasCompletedOnboarding) return 'complete'
    return 'complete' // Default to complete if all are seen
  }

  // Helper function to determine if next step should be disabled
  function isNextStepDisabled(step: string): boolean {
    // For interactive steps, we disable the button until the action is completed
    switch (step) {
      case 'roomCreation': return !hasCreatedRoom
      case 'upload': return !hasUploadedFile
      case 'events': return !hasCreatedEvent
      case 'gallery': return !hasViewedGallery
      default: return false
    }
  }

  if (hasCompletedOnboarding) {
    return null
  }

  const currentStep = getCurrentStep()

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm">
            {['🎉', '📸', '💫', '✨', '🌟', '🚀'][['welcome', 'roomCreation', 'upload', 'events', 'gallery', 'complete'].indexOf(currentStep)]}
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to CoGallery</h2>
        </div>

        <div className="space-y-4 text-center text-white">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <>
              <p className="text-lg">Let's get you set up to start sharing photos collaboratively!</p>
              <button
                onClick={() => setSeenWelcome()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition"
              >
                Let's Go!
              </button>
            </>
          )}

          {/* Room Creation Step */}
          {currentStep === 'roomCreation' && (
            <>
              <p className="text-lg">Create your first room to start organizing photos</p>
              <button
                onClick={() => setCreatedRoom()}
                className={`w-full ${isNextStepDisabled('roomCreation') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition'}`}
                disabled={isNextStepDisabled('roomCreation')}
              >
                {isNextStepDisabled('roomCreation') ? 'Create a Room First' : 'I Created a Room'}
              </button>
            </>
          )}

          {/* Upload Step */}
          {currentStep === 'upload' && (
            <>
              <p className="text-lg">Upload your first photo to share with others</p>
              <button
                onClick={() => setUploadedFile()}
                className={`w-full ${isNextStepDisabled('upload') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition'}`}
                disabled={isNextStepDisabled('upload')}
              >
                {isNextStepDisabled('upload') ? 'Upload a Photo First' : 'I Uploaded a Photo'}
              </button>
            </>
          )}

          {/* Events Step */}
          {currentStep === 'events' && (
            <>
              <p className="text-lg">Create an event to organize photos by occasion</p>
              <button
                onClick={() => setCreatedEvent()}
                className={`w-full ${isNextStepDisabled('events') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition'}`}
                disabled={isNextStepDisabled('events')}
              >
                {isNextStepDisabled('events') ? 'Create an Event First' : 'I Created an Event'}
              </button>
            </>
          )}

          {/* Gallery Step */}
          {currentStep === 'gallery' && (
            <>
              <p className="text-lg">Explore the gallery to see all shared photos</p>
              <button
                onClick={() => setViewedGallery()}
                className={`w-full ${isNextStepDisabled('gallery') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition'}`}
                disabled={isNextStepDisabled('gallery')}
              >
                {isNextStepDisabled('gallery') ? 'View the Gallery First' : 'I Viewed the Gallery'}
              </button>
            </>
          )}

          {/* Completion Step */}
          {currentStep === 'complete' && (
            <>
              <p className="text-lg">You're all set! Start exploring CoGallery</p>
              <button
                onClick={() => setCompletedOnboarding()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition"
              >
                Let's Go!
              </button>
            </>
          )}
        </div>

        <div className="flex justify-between w-full">
          <button
            onClick={() => {
              // Reset onboarding for testing purposes
              // In production, you might want to remove this or make it less accessible
              if (process.env.NODE_ENV === 'development') {
                // Reset logic would go here in dev mode
              }
            }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Reset Tutorial
          </button>
        </div>
      </div>
    </div>
  )
}