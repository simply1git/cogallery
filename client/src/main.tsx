import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA and Background Sync
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
