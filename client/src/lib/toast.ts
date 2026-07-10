import { Toaster, toast } from 'sonner'

// Default toast options for consistency
interface ToastProps {
  duration?: number
  position?: any // ToastPosition
  theme?: any // Theme
  // Add other common properties as needed
  [key: string]: any
}

const defaultToastOptions: ToastProps = {
  duration: 5000,
  position: 'top-right',
  theme: 'dark',
  richColors: true,
}

// Success toast with consistent styling
export function toastSuccess(message: string, options?: ToastProps) {
  toast.success(message, {
    ...defaultToastOptions,
    ...options,
  })
}

// Error toast with consistent styling
export function toastError(message: string, options?: ToastProps) {
  toast.error(message, {
    ...defaultToastOptions,
    duration: options?.duration || 8000, // Errors last longer by default
    ...options,
  })
}

// Warning toast with consistent styling
export function toastWarning(message: string, options?: ToastProps) {
  toast.warning(message, {
    ...defaultToastOptions,
    ...options,
  })
}

// Info toast with consistent styling
export function toastInfo(message: string, options?: ToastProps) {
  toast.info(message, {
    ...defaultToastOptions,
    ...options,
  })
}

// Loading toast with consistent styling - returns toast ID for updates
export function toastLoading(message: string, options?: ToastProps) {
  return toast.loading(message, {
    ...defaultToastOptions,
    ...options,
  })
}

// Custom toast with consistent base styling
export function toastCustom(
  message: string,
  options: Omit<ToastProps, 'duration' | 'position' | 'theme' | 'richColors'> & { duration?: number; position?: any; theme?: any }
) {
  toast(message, {
    ...defaultToastOptions,
    ...options,
  })
}

// Re-export the Toaster component for use in App.tsx
export { Toaster }

// Export the default options for potential customization
export { defaultToastOptions }