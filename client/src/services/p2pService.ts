/**
 * P2P Service
 * WebRTC peer-to-peer file sharing using Supabase Realtime Broadcast for signaling.
 * 
 * Architecture:
 * - Uploaders "seed" their files: they listen for requests and serve files via RTCDataChannel.
 * - Viewers "leech": they request files and receive them via RTCDataChannel.
 * - Supabase Broadcast is used ONLY for signaling (SDP/ICE exchange) — never for file data.
 * 
 * No TURN server needed for most connections (same WiFi, etc).
 * For NAT traversal, we use free STUN servers from Google.
 */

import { supabase } from '@/lib/supabase'
import { getCachedFile } from './photoCache'

// ─── Constants ───────────────────────────────────────────────────────────────


const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

type TransferCallback = (progress: number) => void
type FileReceivedCallback = (photoId: string, blob: Blob, filename: string, mimeType: string) => void

// ─── Shared Event Channels ────────────────────────────────────────────────────

interface PendingRequest {
  offerId: string
  resolve: (res: { blob: Blob; filename: string; mimeType: string } | null) => void
  onProgress?: TransferCallback
  onFileReceived?: FileReceivedCallback
  pc: RTCPeerConnection | null
  chunks: ArrayBuffer[]
  expectedSize: number
  receivedSize: number
  filename: string
  mimeType: string
  timer: any
}

const eventChannels = new Map<string, ReturnType<typeof supabase.channel>>()
const pendingRequests = new Map<string, PendingRequest>() // Key: offerId

function getOrCreateChannel(eventId: string, userId: string) {
  if (eventChannels.has(eventId)) return eventChannels.get(eventId)!

  const channelName = `p2p:${eventId}`
  const channel = supabase.channel(channelName)

  const activePeers = new Map<string, RTCPeerConnection>()

  channel
    // ─── SEEDER LOGIC ───
    .on('broadcast', { event: 'file-request' }, async (payload) => {
      const { requesterId, photoId, offerId } = payload.payload
      if (requesterId === userId) return // Don't respond to self

      const cached = await getCachedFile(photoId)
      if (!cached) return

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      activePeers.set(offerId, pc)

      const dc = pc.createDataChannel(`file:${photoId}`, { ordered: true })
      dc.onopen = async () => {
        dc.send(JSON.stringify({
          type: 'meta',
          filename: cached.filename,
          mimeType: cached.mimeType,
          size: cached.blob.size,
        }))

        // High-performance streaming configuration
        const MAX_CHUNK_SIZE = 64 * 1024 // 64KB chunks for maximum throughput
        dc.bufferedAmountLowThreshold = 2 * 1024 * 1024 // 2MB threshold for back-pressure

        const buffer = await cached.blob.arrayBuffer()
        let offset = 0
        const total = buffer.byteLength

        const sendNextChunk = () => {
          while (offset < total) {
            if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
              // Wait for buffer to drain; the 'onbufferedamountlow' event will resume this
              return
            }
            const end = Math.min(offset + MAX_CHUNK_SIZE, total)
            dc.send(buffer.slice(offset, end))
            offset = end
          }
          // Signal completion once everything is sent
          if (offset >= total) {
            dc.send(JSON.stringify({ type: 'done' }))
          }
        }

        dc.onbufferedamountlow = () => {
          sendNextChunk()
        }

        sendNextChunk()
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { targetId: requesterId, offerId, candidate: e.candidate.toJSON() },
          })
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { targetId: requesterId, senderId: userId, offerId, sdp: offer.sdp },
      })
    })
    .on('broadcast', { event: 'answer' }, async (payload) => {
      const { offerId, sdp } = payload.payload
      const pc = activePeers.get(offerId)
      if (!pc) return
      await pc.setRemoteDescription({ type: 'answer', sdp })
    })
    // ─── LEECHER LOGIC ───
    .on('broadcast', { event: 'offer' }, async (payload) => {
      const { offerId, sdp, targetId, senderId } = payload.payload
      if (targetId !== userId) return
      
      const req = pendingRequests.get(offerId)
      if (!req) return

      // Remember who sent the offer so we can route ICE candidates back to them
      const seederUserId = senderId || null

      req.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      req.pc.ondatachannel = (e) => {
        const dc = e.channel
        dc.onmessage = (msg) => {
          // Clear the initial connection timeout as soon as we start receiving data
          if (req.timer) {
            clearTimeout(req.timer)
            req.timer = null
          }

          if (typeof msg.data === 'string') {
            try {
              const parsed = JSON.parse(msg.data)
              if (parsed.type === 'meta') {
                req.filename = parsed.filename
                req.mimeType = parsed.mimeType
                req.expectedSize = parsed.size
              } else if (parsed.type === 'done') {
                const blob = new Blob(req.chunks, { type: req.mimeType })
                clearTimeout(req.timer)
                if (req.pc) req.pc.close()
                pendingRequests.delete(offerId)
                req.onFileReceived?.(payload.payload.photoId, blob, req.filename, req.mimeType)
                req.resolve({ blob, filename: req.filename, mimeType: req.mimeType })
              }
            } catch { /* ignore */ }
          } else {
            req.chunks.push(msg.data as ArrayBuffer)
            req.receivedSize += (msg.data as ArrayBuffer).byteLength
            if (req.expectedSize > 0) {
              req.onProgress?.(Math.round((req.receivedSize / req.expectedSize) * 100))
            }
          }
        }
      }

      req.pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { targetId: seederUserId, offerId, candidate: e.candidate.toJSON() },
          })
        }
      }

      await req.pc.setRemoteDescription({ type: 'offer', sdp })
      const answer = await req.pc.createAnswer()
      await req.pc.setLocalDescription(answer)

      channel.send({
        type: 'broadcast',
        event: 'answer',
        payload: { offerId, sdp: answer.sdp },
      })
    })
    // ─── SHARED ICE CANDIDATES ───
    .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
      const { offerId, targetId, candidate } = payload.payload
      // Check if we are the seeder
      if (targetId === userId && activePeers.has(offerId)) {
        try {
          await activePeers.get(offerId)!.addIceCandidate(new RTCIceCandidate(candidate))
        } catch { /* ignore */ }
      }
      // Check if we are the leecher
      else if (pendingRequests.has(offerId)) {
        const req = pendingRequests.get(offerId)!
        if (!req.pc) return
        try {
          await req.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch { /* ignore */ }
      }
    })
    .subscribe()

  eventChannels.set(eventId, channel)

  // Attach a custom cleanup method to the channel
  ;(channel as any).customCleanup = () => {
    activePeers.forEach((pc) => pc.close())
    activePeers.clear()
    pendingRequests.forEach((req) => {
      clearTimeout(req.timer)
      if (req.pc) req.pc.close()
      req.resolve(null)
    })
    pendingRequests.clear()
    supabase.removeChannel(channel)
    eventChannels.delete(eventId)
  }

  return channel
}

export function startSeeding(eventId: string, userId: string): () => void {
  getOrCreateChannel(eventId, userId)
  return () => {
    // We do NOT immediately kill the channel because leeching might be using it.
    // However, in a full implementation we'd ref-count it.
    // For now, it lives until the user leaves the event page.
  }
}

export function requestFile(
  eventId: string,
  photoId: string,
  userId: string,
  onProgress?: TransferCallback,
  onFileReceived?: FileReceivedCallback,
  timeoutMs = 15000,
): Promise<{ blob: Blob; filename: string; mimeType: string } | null> {
  return new Promise((resolve) => {
    const channel = getOrCreateChannel(eventId, userId)
    const offerId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const timer = setTimeout(() => {
      const req = pendingRequests.get(offerId)
      if (req) {
        if (req.pc) req.pc.close()
        pendingRequests.delete(offerId)
        resolve(null)
      }
    }, timeoutMs)

    pendingRequests.set(offerId, {
      offerId,
      resolve,
      onProgress,
      onFileReceived,
      pc: null,
      chunks: [],
      expectedSize: 0,
      receivedSize: 0,
      filename: 'download',
      mimeType: 'application/octet-stream',
      timer,
    })

    // Wait a tick to ensure channel is subscribed
    setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'file-request',
        payload: { requesterId: userId, photoId, offerId },
      })
    }, 500)
  })
}
