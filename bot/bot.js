import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { initStore, hasFile, saveFile } from './fileStore.js'
import { handleFileRequest, requestFile } from './webrtc.js'
import nodeDataChannel from 'node-datachannel'
import ws from 'ws'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const BOT_EMAIL = process.env.BOT_EMAIL
const BOT_PASSWORD = process.env.BOT_PASSWORD

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !BOT_EMAIL || !BOT_PASSWORD) {
  console.error("Missing required environment variables.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { 'x-my-custom-header': 'seedbox-bot' } },
  realtime: {
    transport: ws
  }
})

const activePeers = new Map() // offerId -> PeerConnection
const eventChannels = new Map() // eventId -> Supabase Channel

async function main() {
  console.log("🚀 Starting Native CoGallery WebRTC Seedbox Bot...")
  
  await initStore()
  // nodeDataChannel.initLogger('Fatal')

  // 1. Authenticate Bot
  console.log(`🔐 Authenticating as ${BOT_EMAIL}...`)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: BOT_EMAIL,
    password: BOT_PASSWORD,
  })

  if (authError) {
    console.error("Auth Failed:", authError.message)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log(`✅ Authenticated! Bot User ID: ${userId}`)

  // 2. Fetch all events and start listening
  await seedExistingFiles(userId)

  // 3. Listen for new photos being uploaded in real-time
  console.log("👂 Listening for new photo uploads...")
  supabase.channel('db-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' }, (payload) => {
      const photo = payload.new
      console.log(`📸 New photo detected: ${photo.id}`)
      
      // Ensure we are subscribed to this event's P2P channel
      subscribeToEvent(photo.event_id, userId)
      
      // Immediately try to leech it from the original uploader (who is currently online)
      if (photo.uploader_id !== userId) {
        requestFileFromSwarm(photo.event_id, photo, userId)
      }
    })
    .subscribe()

  // 4. Keep alive and handle graceful shutdown
  console.log("🟢 Bot is running and connected to WebRTC network.")
  console.log("Press Ctrl+C to stop.")

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

async function seedExistingFiles(userId) {
  // Get all photos across all events
  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('id, event_id, uploader_id')

  if (photoError) {
    console.error("Failed to fetch photos:", photoError.message)
    return
  }

  console.log(`📦 Found ${photos.length} photos in the database.`)
  
  // Group by event
  const eventsToPhotos = new Map()
  for (const p of photos) {
    if (!eventsToPhotos.has(p.event_id)) {
      eventsToPhotos.set(p.event_id, [])
    }
    eventsToPhotos.get(p.event_id).push(p)
  }

  // Subscribe to all event channels
  for (const [eventId, eventPhotos] of eventsToPhotos.entries()) {
    subscribeToEvent(eventId, userId)

    // Check which ones we actually have cached on disk
    let missingCount = 0
    for (const photo of eventPhotos) {
      const exists = await hasFile(photo.id)
      if (!exists) {
        missingCount++
        // Try to leech it from someone else in the swarm
        requestFileFromSwarm(eventId, photo, userId)
      }
    }
    console.log(`📡 Event ${eventId.slice(0,8)}: Seeding ${eventPhotos.length - missingCount} / ${eventPhotos.length} files.`)
  }
}

function subscribeToEvent(eventId, userId) {
  if (eventChannels.has(eventId)) return

  const channelName = `p2p:${eventId}`
  const channel = supabase.channel(channelName)

  channel
    // When someone asks for a file, we check our disk and send it
    .on('broadcast', { event: 'file-request' }, async (payload) => {
      if (payload.payload.requesterId === userId) return
      handleFileRequest(payload.payload, channel, activePeers)
    })
    
    // When the remote peer answers our local offer
    .on('broadcast', { event: 'answer' }, async (payload) => {
      const { offerId, sdp } = payload.payload
      const pc = activePeers.get(offerId)
      if (!pc) return
      try {
        pc.setRemoteDescription(sdp, 'answer')
      } catch (err) {
        console.error("Error setting answer:", err)
      }
    })
    
    // When someone creates an offer (to us) because we asked for a file
    .on('broadcast', { event: 'offer' }, async (payload) => {
      const { offerId, sdp, targetId } = payload.payload
      // If we are waiting for this file
      const pc = activePeers.get(offerId)
      if (pc && targetId === userId) {
        try {
          pc.setRemoteDescription(sdp, 'offer')
        } catch (err) {
          console.error("Error setting offer:", err)
        }
      }
    })
    
    // Handle ICE candidates
    .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
      const { offerId, targetId, candidate } = payload.payload
      const pc = activePeers.get(offerId)
      if (!pc) return
      
      // If candidate is meant for us, or if we initiated the connection
      if (targetId === userId || targetId === null) {
        try {
          pc.addRemoteCandidate(candidate.candidate, candidate.sdpMid)
        } catch (err) {
          console.error("Error adding candidate:", err)
        }
      }
    })
    .subscribe()

  eventChannels.set(eventId, channel)
}

function requestFileFromSwarm(eventId, photo, userId) {
  const channel = eventChannels.get(eventId)
  if (!channel) return

  console.log(`[Leech] Requesting missing file ${photo.id} from swarm...`)
  requestFile(eventId, photo.id, userId, channel, activePeers, async (photoId, buffer, filename, mimeType) => {
    // We successfully received a file we were missing! Save it to disk.
    await saveFile(photoId, buffer, filename, mimeType)
  })
}

function cleanup() {
  console.log("\n🛑 Shutting down gracefully...")
  for (const pc of activePeers.values()) {
    pc.close()
  }
  activePeers.clear()
  
  for (const channel of eventChannels.values()) {
    supabase.removeChannel(channel)
  }
  eventChannels.clear()
  
  nodeDataChannel.cleanup()
  process.exit(0)
}

main().catch(console.error)
