import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { initObservability } from '@/lib/observability'
import { validateEnv } from '@/lib/env'

validateEnv()
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

// Listen for messages from the service worker (e.g., background sync triggers)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Only accept messages from the same origin for security
    if (event.origin !== window.location.origin) return;

    // Handle message from service worker
    if (event.data && event.data.type === 'TRIGGER_UPLOAD_SYNC') {
      // Trigger upload queue processing when service worker signals a sync
      import('./services/uploadQueueService').then(({ uploadQueueService }) => {
        uploadQueueService.processQueue().catch(err => {
          console.error('Failed to process upload queue from sync trigger:', err);
        });
      });
    }
  });
}