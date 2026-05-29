import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Legacy EventPage — redirects to new hierarchy.
 * Old /event/:code routes are no longer supported.
 * The new flow is: /dashboard → /room/:roomId → /room/:roomId/event/:eventId
 */
export function EventPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="card p-10 space-y-5">
        <h1 className="text-2xl font-bold text-[#f4f4f5]">This link is outdated</h1>
        <p className="text-[#a1a1aa]">
          CoGallery has been upgraded! Events are now organized inside Rooms.
          Please use your dashboard to access your events.
        </p>
        <button
          onClick={() => navigate(isAuthenticated ? '/dashboard' : '/auth')}
          className="btn-blue"
        >
          {isAuthenticated ? 'Go to Dashboard' : 'Sign In'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
