// Custom service worker for handling background sync
// This works alongside the Workbox-generated service worker

// Import the Workbox-generated service worker
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

// Wait for the service worker to activate
self.addEventListener('install', (event) => {
  // Precache the assets listed in the manifest (injected by VitePWA)
  const manifest = self.__WB_MANIFEST || [];
  workbox.precaching.precacheAndRoute(manifest, {
    ignoreURLParametersMatching: [/.*/],
    directoryIndex: '/',
    cleanUrls: true,
  });
  // Force the waiting service worker to become active
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Immediately claim control of clients
  event.waitUntil(self.clients.claim());
});

// Handle background sync events
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-uploads') {
    event.waitUntil(syncUploads());
  }
});

async function syncUploads() {
  // Notify the client that sync is starting
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_START',
      message: 'Starting background sync of uploads'
    });
  });

  try {
    // Check if we're online
    if (!navigator.onLine) {
      throw new Error('Offline, cannot sync');
    }

    // In a real implementation, we would communicate with the main thread
    // to process the upload queue. For now, we'll post a message to trigger
    // processing in the main thread.

    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'TRIGGER_UPLOAD_SYNC',
        message: 'Triggering upload queue processing'
      });
    }

    // Notify completion
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_END',
        message: 'Background sync completed'
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);

    // Notify clients of failure
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ERROR',
        message: `Background sync failed: ${error.message}`
      });
    });
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'REGISTER_SYNC') {
    // Register a sync event
    self.registration.sync.register('sync-uploads')
      .then(() => {
        console.log('Background sync registered');
      })
      .catch(error => {
        console.error('Failed to register background sync:', error);
      });
  }
});

// Add a fetch handler for debugging/logging (optional)
self.addEventListener('fetch', (event) => {
  // Log certain requests for debugging
  if (event.request.destination === 'image' || event.request.destination === 'video') {
    // Optional: log media requests
    // console.log('SW intercepted media request:', event.request.url);
  }
});