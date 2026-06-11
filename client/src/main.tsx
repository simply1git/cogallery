import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { initObservability } from '@/lib/observability'

initObservability()
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA and Background Sync
const updateSW = registerSW({
  onNeedRefresh() {
    // Silently update the service worker — the next navigation will use the new version.
    // This avoids a jarring confirm() dialog that blocks the main thread.
    updateSW(true)
  },
  onOfflineReady() {
    // App is cached and ready to work offline
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
