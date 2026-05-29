import { useNavigate } from 'react-router-dom'
import { ArrowRight, FolderOpen } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Legacy CreateEventPage — the new flow creates events inside Rooms.
 * Redirect users to dashboard where they can create rooms and then events.
 */
export function CreateEventPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="card p-10 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
          <FolderOpen size={28} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-[#f4f4f5]">Create an Event</h1>
        <p className="text-[#a1a1aa]">
          Events are now created inside Rooms. Go to your dashboard, open or create a Room,
          then add Events to organize your photos and videos.
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
