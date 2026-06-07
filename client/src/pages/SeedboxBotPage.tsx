import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { startSeeding, requestFile } from '@/services/p2pService'
import { cacheFile, hasFile, getCacheSize } from '@/services/photoCache'
import { formatFileSize } from '@/services/uploadService'
import { useAuth } from '@/hooks/useAuth'
import type { Photo } from '@/types'

export function SeedboxBotPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<string[]>(['Bot initialized.'])
  const [cacheSize, setCacheSizeBytes] = useState(0)

  const log = (msg: string) => {
    console.log('[BOT]', msg)
    setLogs((prev) => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => {
    if (!user) {
      log('Waiting for authentication...')
      return
    }

    log(`Authenticated as ${user.id}`)

    const seededEvents = new Set<string>()
    const cleanupFns: (() => void)[] = []

    const seedEvent = (eventId: string) => {
      if (!seededEvents.has(eventId)) {
        log(`Started seeding event: ${eventId}`)
        seededEvents.add(eventId)
        cleanupFns.push(startSeeding(eventId, user.id))
      }
    }

    const ensurePhotoCached = async (photo: Photo) => {
      if (!photo.s3Key?.startsWith('p2p:')) return

      seedEvent(photo.eventId) // Ensure we are seeding this event

      const exists = await hasFile(photo.id)
      if (exists) return

      log(`Requesting file ${photo.id} (${photo.filename})...`)
      
      try {
        const res = await requestFile(
          photo.eventId,
          photo.id,
          user.id,
          undefined,
          undefined,
          60000 // 1 minute timeout for bot
        )

        if (res) {
          log(`Successfully downloaded ${photo.filename}. Caching...`)
          await cacheFile(photo.id, res.blob, res.filename, res.mimeType)
          updateCacheSize()
        } else {
          log(`Failed to download ${photo.filename}: uploader offline.`)
        }
      } catch (err) {
        log(`Error downloading ${photo.filename}: ${err}`)
      }
    }

    const updateCacheSize = async () => {
      const size = await getCacheSize()
      setCacheSizeBytes(size)
    }

    // 1. Initial sync: get all P2P photos
    const syncExisting = async () => {
      log('Syncing existing P2P photos...')
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .like('s3_key', 'p2p:%')

      if (error) {
        log(`Sync error: ${error.message}`)
        return
      }

      if (data) {
        log(`Found ${data.length} P2P photos. Checking cache...`)
        for (const row of data) {
          const photo = {
            id: row.id,
            eventId: row.event_id,
            s3Key: row.s3_key,
            filename: row.filename,
          } as Photo
          // Don't await them all in parallel to avoid crushing network
          await ensurePhotoCached(photo)
        }
      }
      updateCacheSize()
    }

    syncExisting()

    // 2. Realtime listener for new photos
    const channel = supabase
      .channel('bot-photos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos' },
        (payload) => {
          const row = payload.new
          const photo = {
            id: row.id,
            eventId: row.event_id,
            s3Key: row.s3_key,
            filename: row.filename,
          } as Photo
          ensurePhotoCached(photo)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      cleanupFns.forEach((fn) => fn())
    }
  }, [user])

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono text-sm flex flex-col">
      <div className="flex items-center justify-between mb-8 border-b border-green-900 pb-4">
        <div>
          <h1 className="text-xl font-bold mb-1">CoGallery WebRTC Seedbox Bot</h1>
          <p className="text-green-600">Running headless. Keeping files alive 24/7.</p>
        </div>
        <div className="text-right">
          <p>Status: {user ? 'ONLINE' : 'OFFLINE'}</p>
          <p>Total Cache: {formatFileSize(cacheSize)}</p>
        </div>
      </div>

      <div className="flex-1 bg-[#0a0a0a] rounded-lg border border-green-900/50 p-4 overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i} className="mb-1">{log}</div>
        ))}
      </div>
    </div>
  )
}
