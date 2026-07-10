import { Toaster, ToastOptions } from 'sonner'
import { useCallback } from 'react'

// Default toast options for consistency
const defaultToastOptions: ToastOptions = {
  duration: 5000,
  position: 'top-right' as const,
  theme: 'dark',
  richColors: true,
}

/**
 * Centralized toast manager for consistent notifications across the app
 */
export function useToast() {
  const success = useCallback((message: string, options?: ToastOptions) => {
    return toast.success(message, {
      ...defaultToastOptions,
      ...options,
    })
  }, [])

  const error = useCallback((message: string, options?: ToastOptions) => {
    return toast.error(message, {
      ...defaultToastOptions,
      duration: options?.duration || 8000, // Errors last longer by default
      ...options,
    })
  }, [])

  const warning = useCallback((message: string, options?: ToastOptions) => {
    return toast.warning(message, {
      ...defaultToastOptions,
      ...options,
    })
  }, [])

  const info = useCallback((message: string, options?: ToastOptions) => {
    return toast.info(message, {
      ...defaultToastOptions,
      ...options,
    })
  }, [])

  return { success, error, warning, info }
}

// Re-export the Toaster component for use in App.tsx
export { Toaster }