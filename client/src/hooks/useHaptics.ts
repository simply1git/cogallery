import { useCallback } from 'react'

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

/**
 * A custom hook to trigger device vibrations (haptics) on supported devices.
 * Uses the Web Vibration API. Falls back gracefully on unsupported devices (e.g. iOS Safari currently has spotty support, but Android supports it well).
 */
export function useHaptics() {
  const trigger = useCallback((pattern: HapticPattern) => {
    // Check if the vibration API is supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        switch (pattern) {
          case 'light':
            // Subtle tap (e.g., selection toggle, keyboard tap)
            navigator.vibrate(10)
            break
          case 'medium':
            // Solid tap (e.g., liking a photo)
            navigator.vibrate(25)
            break
          case 'heavy':
            // Strong thud (e.g., deleting an item)
            navigator.vibrate(50)
            break
          case 'success':
            // Two rapid taps
            navigator.vibrate([15, 50, 15])
            break
          case 'warning':
            // Two longer taps
            navigator.vibrate([30, 50, 30])
            break
          case 'error':
            // Three rapid taps
            navigator.vibrate([20, 40, 20, 40, 20])
            break
          default:
            navigator.vibrate(15)
        }
      } catch (e) {
        // Ignore errors if the browser blocks vibration (e.g. requires user gesture)
      }
    }
  }, [])

  return { haptic: trigger }
}
