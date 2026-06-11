import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, logout } = useAuthStore()

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email,
            displayName: session.user.user_metadata?.displayName || session.user.email?.split('@')[0] || 'User',
            avatarUrl: session.user.user_metadata?.avatarUrl,
            createdAt: session.user.created_at,
          }
          setUser(userData)
        } else {
          // No session — mark loading as done
          setUser(null)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.displayName || session.user.email?.split('@')[0] || 'User',
          avatarUrl: session.user.user_metadata?.avatarUrl,
          createdAt: session.user.created_at,
        }
        setUser(userData)
      } else {
        setUser(null)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [setUser])

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  }
}
