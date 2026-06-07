import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Compass, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHaptics } from '@/hooks/useHaptics'

export function BottomNav({ onOpenProfile }: { onOpenProfile: () => void }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const { haptic } = useHaptics()

  if (!isAuthenticated) return null

  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/'
  const isExplore = location.pathname.startsWith('/explore') // Placeholder for future explore/scan

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="bg-[#080808]/80 backdrop-blur-2xl border-t border-white/[0.08] px-6 py-3 flex items-center justify-between">
        
        <Link
          to="/dashboard"
          onClick={() => haptic('light')}
          className={`flex flex-col items-center gap-1 min-w-[64px] transition-transform active:scale-95 ${
            isDashboard ? 'text-blue-400' : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          <LayoutDashboard size={22} className={isDashboard ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <button
          onClick={() => {
            haptic('light')
            // navigate to scan/explore in future
          }}
          className={`flex flex-col items-center gap-1 min-w-[64px] transition-transform active:scale-95 ${
            isExplore ? 'text-blue-400' : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          <Compass size={22} />
          <span className="text-[10px] font-medium">Explore</span>
        </button>

        <button
          onClick={() => {
            haptic('light')
            onOpenProfile()
          }}
          className="flex flex-col items-center gap-1 min-w-[64px] text-[#71717a] hover:text-[#a1a1aa] transition-transform active:scale-95"
        >
          <User size={22} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>

      </div>
    </div>
  )
}
