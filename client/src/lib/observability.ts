type ErrorContext = Record<string, unknown>

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initObservability() {
  if (!DSN) return
  console.info('[CoGallery] Error reporting enabled')
}

export function reportError(error: unknown, context?: ErrorContext) {
  const payload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    timestamp: new Date().toISOString(),
  }

  console.error('[CoGallery]', payload)

  if (!DSN || typeof window === 'undefined') return

  const apiUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL
  if (!apiUrl) return

  fetch(`${apiUrl}/telemetry/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}
