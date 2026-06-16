export function validateEnv() {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_BACKEND_URL',
  ]

  const missing = requiredVars.filter(
    (key) => !import.meta.env[key] || import.meta.env[key].includes('placeholder')
  )

  if (missing.length > 0) {
    const errorMsg = `[Config Error] Missing required environment variables: ${missing.join(', ')}`
    console.error(errorMsg)
    // We throw to prevent the app from booting in a completely broken state,
    // which gives immediate feedback to developers instead of cryptic network failures later.
    throw new Error(errorMsg)
  }
}
