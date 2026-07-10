import { supabase } from '@/lib/supabase'
import { User } from '@/types'
import { logAuthEvent } from '@/services/activityService'

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName,
        },
      },
    })

    if (error) {
      await logAuthEvent('sign_up', null, email, false, error.message)
      return { data: null, error: error.message }
    }

    // Manually create the profile if the trigger failed or was dropped
    if (data?.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        display_name: displayName,
      })
      if (profileError) {
        console.warn('Failed to create profile row manually:', profileError)
      }

      await logAuthEvent('sign_up', data.user.id, email, true)
    }

    return { data, error: null }
  } catch (error: any) {
    await logAuthEvent('sign_up', null, email, false, error.message)
    return { data: null, error: error.message }
  }
}



export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      await logAuthEvent('sign_in', null, email, false, error.message)
      return { data: null, error: error.message }
    }

    if (data.user) {
      await logAuthEvent('sign_in', data.user.id, email, true)
    }

    return { data, error: null }
  } catch (error: any) {
    await logAuthEvent('sign_in', null, email, false, error.message)
    return { data: null, error: error.message }
  }
}


export async function signOut() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || null
    const email = user?.email || null

    await logAuthEvent('sign_out', userId, email, true)

    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error: any) {
    await logAuthEvent('sign_out', null, null, false, error.message)
    return { error: error.message }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.displayName || user.email?.split('@')[0] || 'User',
      avatarUrl: user.user_metadata?.avatarUrl,
      createdAt: user.created_at,
    }
  } catch (error) {
    console.error('Failed to get current user:', error)
    return null
  }
}

export async function updateProfile(updates: { displayName?: string; avatarUrl?: string }) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    })

    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    return { data: null, error: error.message }
  }
}

export async function updatePassword(password: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || null

    await logAuthEvent('password_update', userId, null, true)

    const { data, error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      await logAuthEvent('password_update', userId, null, false, error.message)
      throw error
    }

    return { data, error: null }
  } catch (error: any) {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || null
    await logAuthEvent('password_update', userId, null, false, error.message)
    return { data: null, error: error.message }
  }
}

export async function resetPassword(email: string) {
  try {
    await logAuthEvent('password_reset', null, email, true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL || 'http://localhost:5173'}/reset-password`,
    })

    if (error) {
      await logAuthEvent('password_reset', null, email, false, error.message)
      throw error
    }

    return { error: null }
  } catch (error: any) {
    await logAuthEvent('password_reset', null, email, false, error.message)
    return { error: error.message }
  }
}

export async function getUserProfile(userId: string) {
  try {
    // This requires a custom RPC function in Supabase to read auth.users metadata securely.
    // If you haven't created it, this will fail or return null.
    const { data, error } = await supabase.rpc('get_user_profile', { profile_id: userId })
    
    if (error) throw error
    
    return { 
      data: {
        user_metadata: {
          full_name: data?.display_name,
          avatar_url: data?.avatar_url
        },
        email: data?.email
      }, 
      error: null 
    }
  } catch (error: any) {
    console.error('Failed to get user profile:', error)
    return { data: null, error: error.message }
  }
}
