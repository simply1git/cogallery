import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'CoGallery',
        short_name: 'CoGallery',
        description: 'Collaborative Photo Gallery for Events',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            // Cache Supabase API calls
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache Media Streams from the Oracle Node
            urlPattern: /\/stream\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'oracle-media-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200, 206]
              }
            }
          },
          {
            // Cache static assets (CSS, JS, images, media) with stale-while-revalidate
            urlPattern: /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|mp4|webm|ogg|mp3|wav|woff2?|ttf|eot)(\?.*|$)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-asset-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              plugin: typeof workbox !== 'undefined' ?
                new workbox.expiration.Plugin({
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                  purgeOnQuotaError: true
                }) : undefined
            }
          },
          {
            // Cache thumbnails and user-generated content with cache-first
            urlPattern: /\/(thumbnails?|uploads?|avatars?)\/.*\.(?:jpg|jpeg|png|gif|webp|mp4|webm)(\?.*|$)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'user-content-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      // Use our custom service worker
      srcDir: 'src',
      filename: 'custom-service-worker.js',
      strategies: 'injectManifest'
    }),
    // Enable bundle visualizer in build mode
    process.env.NODE_ENV === 'production' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'supabase': ['@supabase/supabase-js'],
          'ui': ['sonner', 'lucide-react'],
          'gallery': ['masonic', 'framer-motion'],
          'canvas': ['tldraw'],
        }
      },
    }
  }
})
