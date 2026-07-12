/**
 * Feature flag system for gradual rollouts and A/B testing
 *
 * This module provides:
 * 1. A simple API to check if features are enabled
 * 2. Functions to update feature flags at runtime
 * 3. Event-based notifications for real-time updates
 *
 * Feature flags are stored in memory and reset on page reload.
 * For production, consider integrating with a remote config service.
 */

// Default feature flags - all disabled by default for safe rollouts
const FEATURE_FLAGS = {
  // UI/UX Features
  enhancedPhotoGrid: false, // Virtualized photo grid for large galleries (>20 items)

  // Performance Features
  advancedHashing: false,   // Web Worker-based SHA-256 hashing for file deduplication

  // Upload Features
  enhancedUploads: false,   // Enhanced upload queue with better retry logic

  // Experimental Features
  experimentalP2p: false,   // Experimental P2P photo sharing (future)

  // Add more feature flags as needed
  // Example: newFeature: false
};

/**
 * Check if a feature is enabled
 * @param key The feature flag key to check
 * @returns boolean indicating if the feature is enabled
 */
export const isFeatureEnabled = (key: string): boolean => {
  if (Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key)) {
    return FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS];
  }
  console.warn(`[FeatureFlags] Unknown feature flag: ${key}`);
  return false;
};

/**
 * Set a feature flag to a specific value
 * @param key The feature flag key to set
 * @param value The value to set (true/false)
 */
export const setFeatureFlag = (key: string, value: boolean): void => {
  if (Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key)) {
    FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS] = value;

    // Dispatch event for real-time updates to subscribed components
    window.dispatchEvent(new CustomEvent('feature:change', {
      detail: { featureKey: key, enabled: value }
    }));
  } else {
    console.warn(`[FeatureFlags] Unknown feature flag: ${key}`);
  }
};

/**
 * Toggle a feature flag (false -> true, true -> false)
 * @param key The feature flag key to toggle
 */
export const toggleFeatureFlag = (key: string): void => {
  if (Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key)) {
    FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS] = !FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS];

    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('feature:change', {
      detail: {
        featureKey: key,
        enabled: FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS]
      }
    }));
  } else {
    console.warn(`[FeatureFlags] Unknown feature flag: ${key}`);
  }
};

/**
 * Get all feature flags and their current values
 * @returns Object containing all feature flags and their values
 */
export const getAllFeatureFlags = (): Record<string, boolean> => {
  return { ...FEATURE_FLAGS };
};

/**
 * Reset all feature flags to their default values
 */
export const resetFeatureFlags = (): void => {
  // Reset to initial state (all false)
  Object.keys(FEATURE_FLAGS).forEach(key => {
    FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS] = false;
  });

  // Dispatch events for all flags being reset
  Object.keys(FEATURE_FLAGS).forEach(key => {
    window.dispatchEvent(new CustomEvent('feature:change', {
      detail: { featureKey: key, enabled: false }
    }));
  });
};

// Initialize with any values from localStorage (for persistence across refreshes during development)
const loadSavedFlags = () => {
  try {
    const saved = localStorage.getItem('featureFlags');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.keys(parsed).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key)) {
            FEATURE_FLAGS[key as keyof typeof FEATURE_FLAGS] = !!parsed[key];
          }
        });
      }
    }
  } catch (e) {
    console.warn('[FeatureFlags] Failed to load saved flags', e);
  }
};

// Save flags to localStorage when they change (for development persistence)
const setupSaveListener = () => {
  window.addEventListener('feature:change', (e) => {
    const { featureKey, enabled } = (e as CustomEvent).detail as { featureKey: string; enabled: boolean };
    try {
      const current = localStorage.getItem('featureFlags');
      const flags = current ? JSON.parse(current) : {};
      flags[featureKey] = enabled;
      localStorage.setItem('featureFlags', JSON.stringify(flags));
    } catch (e) {
      console.warn('[FeatureFlags] Failed to save flag to localStorage', e);
    }
  });
};

// Initialize
if (typeof window !== 'undefined') {
  loadSavedFlags();
  setupSaveListener();
}