import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface Peer {
  id: string
  connection: RTCPeerConnection
  channel?: RTCDataChannel
}

export function useWebRTCMesh(roomId: string, userId: string) {
  const peersRef = useRef<Map<string, Peer>>(new Map())
  const [activePeers, setActivePeers] = useState<string[]>([])
  
  // This channel acts as our Signaling Server
  const signalingChannel = useRef(supabase.channel(`room-signaling:${roomId}`))

  const updatePeersState = () => {
    setActivePeers(Array.from(peersRef.current.keys()))
  }

  const receiveBuffers = useRef<Map<string, { chunks: ArrayBuffer[], total: number, filename: string, type: string }>>(new Map())
  const currentReceivingFile = useRef<string | null>(null)

  const setupDataChannel = (dc: RTCDataChannel, peerId: string) => {
    dc.onopen = () => {
      console.log(`[WebRTC] Connected to peer ${peerId}`)
      toast.success(`Connected to local peer (AirDrop active)`)
    }
    
    dc.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'metadata') {
            receiveBuffers.current.set(msg.fileId, {
              chunks: [],
              total: msg.totalChunks,
              filename: msg.filename,
              type: msg.fileType
            })
            currentReceivingFile.current = msg.fileId
            console.log(`[WebRTC] Incoming file metadata: ${msg.filename}`)
          }
        } catch (err) {
          console.error('[WebRTC] Failed to parse message', err)
        }
      } else if (e.data instanceof ArrayBuffer) {
        const fileId = currentReceivingFile.current
        if (!fileId) return
        
        const fileData = receiveBuffers.current.get(fileId)
        if (!fileData) return

        fileData.chunks.push(e.data)

        if (fileData.chunks.length === fileData.total) {
          // File complete!
          console.log(`[WebRTC] Reassembled file: ${fileData.filename}`)
          const blob = new Blob(fileData.chunks, { type: fileData.type })
          
          // Trigger download
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.style.display = 'none'
          a.href = url
          a.download = fileData.filename
          document.body.appendChild(a)
          a.click()
          
          // Cleanup
          setTimeout(() => {
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }, 100)

          receiveBuffers.current.delete(fileId)
          currentReceivingFile.current = null
          toast.success(`Received ${fileData.filename} via AirDrop!`)
        }
      }
    }
  }

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signalingChannel.current.send({
          type: 'broadcast',
          event: 'webrtc-ice',
          payload: { targetId, senderId: userId, candidate: e.candidate }
        })
      }
    }

    pc.ondatachannel = (e) => {
      const peer = peersRef.current.get(targetId)
      if (peer) {
        peer.channel = e.channel
        setupDataChannel(e.channel, targetId)
      }
    }

    const peer: Peer = { id: targetId, connection: pc }
    peersRef.current.set(targetId, peer)
    updatePeersState()
    return pc
  }

  const initiateConnection = async (targetId: string) => {
    if (peersRef.current.has(targetId)) return
    
    const pc = createPeerConnection(targetId)
    const dc = pc.createDataChannel('file-transfer', { negotiated: false })
    // Important for binary sending
    dc.binaryType = 'arraybuffer'
    
    peersRef.current.get(targetId)!.channel = dc
    setupDataChannel(dc, targetId)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    signalingChannel.current.send({
      type: 'broadcast',
      event: 'webrtc-offer',
      payload: { targetId, senderId: userId, sdp: offer }
    })
  }

  useEffect(() => {
    if (!roomId || !userId) return

    const channel = signalingChannel.current

    channel
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetId !== userId) return
        
        const pc = createPeerConnection(payload.senderId)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        channel.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: { targetId: payload.senderId, senderId: userId, sdp: answer }
        })
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.targetId !== userId) return
        const peer = peersRef.current.get(payload.senderId)
        if (peer) {
          await peer.connection.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        }
      })
      .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
        if (payload.targetId !== userId) return
        const peer = peersRef.current.get(payload.senderId)
        if (peer) {
          await peer.connection.addIceCandidate(new RTCIceCandidate(payload.candidate))
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
           // Announce presence
           channel.send({ type: 'broadcast', event: 'peer-joined', payload: { senderId: userId } })
        }
      })

    channel.on('broadcast', { event: 'peer-joined' }, ({ payload }) => {
      if (payload.senderId === userId) return
      // Create offer to new peer
      initiateConnection(payload.senderId)
    })

    return () => {
      const currentPeers = peersRef.current;
      currentPeers.forEach(p => p.connection.close())
      currentPeers.clear()
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId])

  // Public API to broadcast a file
  const sendFileToAllPeers = async (fileBuffer: ArrayBuffer, filename: string, fileType: string) => {
    const CHUNK_SIZE = 16384 // 16KB is safe for all browsers
    const totalChunks = Math.ceil(fileBuffer.byteLength / CHUNK_SIZE)
    const fileId = Math.random().toString(36).substring(7)

    for (const [_, peer] of peersRef.current.entries()) {
      const dc = peer.channel
      if (dc?.readyState === 'open') {
        // Send metadata first
        dc.send(JSON.stringify({ type: 'metadata', fileId, filename, fileType, totalChunks }))
        
        // Chunk and send with backpressure handling
        for (let i = 0; i < totalChunks; i++) {
          const chunk = fileBuffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          
          // Handle backpressure
          while (dc.bufferedAmount > dc.bufferedAmountLowThreshold || dc.bufferedAmount > 1024 * 1024) {
             // Wait for buffer to drain if it gets larger than 1MB
             await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          dc.send(chunk)
        }
      }
    }
  }

  return { activePeers, sendFileToAllPeers }
}
