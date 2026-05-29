import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthForm } from '@/components/auth/AuthForm'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/dashboard'
  const { isAuthenticated } = useAuth()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnTo)
    }
  }, [isAuthenticated, navigate, returnTo])

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Hero */}
      <div className="hidden lg:flex w-1/2 bg-[#09090b] relative overflow-hidden flex-col justify-between p-12 border-r border-white/10">
        {/* Abstract background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-transparent z-0"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-500/20 blur-[100px] mix-blend-screen z-0"></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Camera size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            CoGallery
          </span>
        </div>

        <div className="relative z-10 max-w-lg mt-auto mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Share memories with the people who matter.
          </h1>
          <p className="text-lg text-slate-400">
            The premium, secure space for your trips, events, and shared moments. Create ephemeral rooms and high-res albums effortlessly.
          </p>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-[#09090b] relative">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome back</h2>
            <p className="text-slate-400">Enter your details to access your galleries</p>
          </div>

          <AuthForm initialMode="login" />

          <p className="text-center lg:text-left text-sm text-slate-500">
            By continuing, you agree to our{' '}
            <a href="#" className="text-slate-300 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-slate-300 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
