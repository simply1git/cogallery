import { useEffect, useState } from 'react'
import { isFeatureEnabled } from '@/lib/featureFlags'

/**
 * Hook to subscribe to feature flag changes
 * @param featureKey The feature flag key to subscribe to
 * @returns boolean indicating if the feature is enabled
 */
export function useFeatureFlag(featureKey: string): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    // Initialize with current value
    return isFeatureEnabled(featureKey)
  })

  useEffect(() => {
    // Update when the feature flag changes
    const handleFeatureChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ featureKey: string; enabled: boolean }>
      if (customEvent.detail.featureKey === featureKey) {
        setEnabled(customEvent.detail.enabled)
      }
    }

    // Listen for feature flag changes
    window.addEventListener('feature:change', handleFeatureChange)

    return () => {
      window.removeEventListener('feature:change', handleFeatureChange)
    }
  }, [featureKey])

  return enabled
}