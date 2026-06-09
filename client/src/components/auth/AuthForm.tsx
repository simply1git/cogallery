import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, User, Check, AlertCircle } from 'lucide-react'
import { Button, Input } from '@/components/ui/FormInputs'
import { FormField } from '@/components/ui/FormElements'
import { signUpWithEmail, signInWithEmail, resetPassword } from '@/services/authService'

interface AuthFormProps {
  initialMode?: 'login' | 'signup' | 'reset'
}

export function AuthForm({ initialMode = 'login' }: AuthFormProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/dashboard'
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    confirmPassword: '',
  })

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0
    if (pass.length > 0) score += 1
    if (pass.length >= 8) score += 1
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 1
    return score // 0 to 4
  }
  const strength = getPasswordStrength(formData.password)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
    setSuccessMessage('')
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.email || !formData.password || !formData.displayName) {
      setError('All fields are required')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (strength < 2) {
      setError('Please choose a stronger password')
      return
    }

    setIsLoading(true)
    const { data, error: err } = await signUpWithEmail(formData.email, formData.password, formData.displayName)
    setIsLoading(false)

    if (err) {
      setError(err)
    } else if (data?.user && !data.session) {
      // Email verification required
      setSuccessMessage('Account created! Please check your email to verify your account.')
      setFormData({ email: '', password: '', displayName: '', confirmPassword: '' })
    } else {
      // Auto-login (email verification off)
      navigate(returnTo)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.email || !formData.password) {
      setError('Email and password are required')
      return
    }

    setIsLoading(true)
    const { error: err } = await signInWithEmail(formData.email, formData.password)
    setIsLoading(false)

    if (err) {
      setError(err)
    } else {
      navigate(returnTo)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.email) {
      setError('Email is required')
      return
    }

    setIsLoading(true)
    const { error: err } = await resetPassword(formData.email)
    setIsLoading(false)

    if (err) {
      setError(err)
    } else {
      setSuccessMessage('Password reset instructions sent to your email.')
    }
  }



  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'login') {
      handleSignIn(e)
    } else if (mode === 'signup') {
      handleSignUp(e)
    } else if (mode === 'reset') {
      handleReset(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2 animate-slide-up">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2 animate-slide-up">
          <Check size={16} className="mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Display Name */}
      {mode === 'signup' && (
        <FormField label="Display Name" required>
          <div className="relative">
            <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              type="text"
              name="displayName"
              placeholder="Your name"
              value={formData.displayName}
              onChange={handleChange}
              className="pl-11 py-3 bg-[#18181b] border-white/10 focus:border-blue-500 rounded-xl"
            />
          </div>
        </FormField>
      )}

      {/* Email */}
      <FormField label="Email address" required>
        <div className="relative">
          <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            className="pl-11 py-3 bg-[#18181b] border-white/10 focus:border-blue-500 rounded-xl"
          />
        </div>
      </FormField>

      {/* Password */}
      {mode !== 'reset' && (
        <div className="space-y-1">
          <FormField label="Password" required>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="pl-11 py-3 bg-[#18181b] border-white/10 focus:border-blue-500 rounded-xl"
              />
            </div>
          </FormField>

          {/* Forgot Password Link */}
          {mode === 'login' && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('reset')
                  setError('')
                  setSuccessMessage('')
                }}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}
          
          {/* Password Strength Indicator */}
          {mode === 'signup' && formData.password.length > 0 && (
            <div className="pt-2">
              <div className="flex gap-1.5 h-1.5 w-full">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                      strength >= level
                        ? strength < 2
                          ? 'bg-red-500'
                          : strength < 4
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 text-right">
                {strength < 2 && 'Weak'}
                {strength === 2 && 'Fair'}
                {strength === 3 && 'Good'}
                {strength === 4 && 'Strong'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirm Password */}
      {mode === 'signup' && (
        <FormField label="Confirm Password" required>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`pl-11 py-3 bg-[#18181b] rounded-xl border ${
                formData.confirmPassword && formData.password !== formData.confirmPassword 
                  ? 'border-red-500 focus:border-red-500' 
                  : formData.confirmPassword && formData.password === formData.confirmPassword
                  ? 'border-emerald-500 focus:border-emerald-500'
                  : 'border-white/10 focus:border-blue-500'
              }`}
            />
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <Check size={18} className="absolute right-3.5 top-3.5 text-emerald-500" />
            )}
          </div>
        </FormField>
      )}

      {/* Submit Button */}
      <Button 
        type="submit" 
        size="lg" 
        className="w-full mt-4 bg-white text-black hover:bg-slate-200 active:bg-slate-300 font-semibold rounded-xl" 
        isLoading={isLoading}
      >
        {mode === 'login' ? 'Sign in to CoGallery' : mode === 'signup' ? 'Create your account' : 'Send Reset Link'}
      </Button>

      {/* Mode Toggles */}
      <div className="pt-6 mt-6 border-t border-white/10 flex flex-col gap-3">
        {mode !== 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setFormData({ email: '', password: '', displayName: '', confirmPassword: '' })
              setError('')
            }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Already have an account? <span className="font-semibold text-white">Sign in</span>
          </button>
        )}

        {mode !== 'signup' && (
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setFormData({ email: '', password: '', displayName: '', confirmPassword: '' })
              setError('')
              setSuccessMessage('')
            }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Don't have an account? <span className="font-semibold text-white">Sign up</span>
          </button>
        )}


      </div>
    </form>
  )
}
