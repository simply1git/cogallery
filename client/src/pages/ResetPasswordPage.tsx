import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, AlertCircle, Check } from 'lucide-react'
import { Button, Input } from '@/components/ui/FormInputs'
import { FormField } from '@/components/ui/FormElements'
import { updatePassword } from '@/services/authService'
import { supabase } from '@/lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Listen for auth state change to ensure we have the session from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Ready to update password
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    const { error: err } = await updatePassword(password)
    setIsLoading(false)

    if (err) {
      setError(err)
    } else {
      setSuccess('Password updated successfully! Redirecting...')
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#09090b]">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>
          <p className="text-slate-400">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-[#18181b] p-8 rounded-2xl border border-white/10">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
              <Check size={16} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <FormField label="New Password" required>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 py-3 bg-[#09090b] border-white/10 focus:border-blue-500 rounded-xl"
              />
            </div>
          </FormField>

          <FormField label="Confirm New Password" required>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-11 py-3 bg-[#09090b] border-white/10 focus:border-blue-500 rounded-xl"
              />
            </div>
          </FormField>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full mt-4 bg-white text-black hover:bg-slate-200 active:bg-slate-300 font-semibold rounded-xl" 
            isLoading={isLoading}
          >
            Update Password
          </Button>
        </form>
      </div>
    </div>
  )
}
