import { Link, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, Menu, X, Settings, Download } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/authService'
import { useState } from 'react'
import { ProfileSettingsModal } from '@/components/modals/ProfileSettingsModal'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export function Header() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const { isInstallable, promptInstall } = usePWAInstall()

  const handleLogout = async () => {
    await signOut()
    logout()
    navigate('/')
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#080808]/90 backdrop-blur-xl pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-15 py-3">

            {/* Logo */}
            <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
              <img src="/logo-transparent.png" alt="CoGallery Logo" className="w-8 h-8 object-contain" />
              <span className="text-lg font-bold text-[#f4f4f5] tracking-tight">CoGallery</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all"
                >
                  <LayoutDashboard size={15} />
                  Dashboard
                </Link>
              ) : (
                <>
                  <a href="/#how-it-works" className="px-3 py-2 rounded-lg text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all">
                    How It Works
                  </a>
                  <a href="/#features" className="px-3 py-2 rounded-lg text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-all">
                    Features
                  </a>
                </>
              )}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-2">
              {isInstallable && (
                <button 
                  onClick={promptInstall}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-sm font-medium"
                >
                  <Download size={15} />
                  Install App
                </button>
              )}
              {isAuthenticated && user ? (
                <div className="relative group">
                  <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.displayName}
                        className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.displayName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="hidden sm:inline text-sm font-medium text-[#e4e4e7] max-w-[120px] truncate">
                      {user.displayName}
                    </span>
                  </button>

                  {/* Dropdown */}
                  <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-[#111] border border-white/[0.08] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none group-hover:pointer-events-auto">
                    <div className="p-3">
                      <p className="text-xs text-[#71717a] mb-0.5">Signed in as</p>
                      <p className="text-sm font-semibold text-[#f4f4f5] truncate">{user.displayName}</p>
                      {user.email && <p className="text-xs text-[#52525b] truncate">{user.email}</p>}
                    </div>
                    <div className="divider" />
                    <div className="p-1.5">
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
                      >
                        <LayoutDashboard size={15} />
                        Dashboard
                      </Link>
                      <button
                        onClick={() => setIsProfileOpen(true)}
                        className="w-full flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Settings size={15} />
                        Profile Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        id="signout-btn"
                        className="w-full flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link to="/auth" id="header-signin-btn" className="btn-primary text-sm px-4 py-2">
                  Sign In
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                className="md:hidden btn-icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-white/[0.07] py-3 space-y-1 animate-slide-down">
              {isInstallable && (
                <button
                  onClick={promptInstall}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-white/5 rounded-lg mb-2"
                >
                  <Download size={15} />
                  Install CoGallery App
                </button>
              )}
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <LayoutDashboard size={15} />
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsProfileOpen(true)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-lg"
                  >
                    <Settings size={15} />
                    Profile Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <a href="/#how-it-works" className="block px-3 py-2.5 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-lg">
                    How It Works
                  </a>
                  <Link to="/auth" className="block px-3 py-2.5 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-lg">
                    Sign In
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Modals */}
      <ProfileSettingsModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </>
  )
}
