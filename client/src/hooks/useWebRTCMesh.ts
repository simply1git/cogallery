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
      peersRef.current.forEach(p => p.connection.close())
      peersRef.current.clear()
      supabase.removeChannel(channel)
    }
  }, [roomId, userId])

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

  const setupDataChannel = (dc: RTCDataChannel, peerId: string) => {
    dc.onopen = () => {
      console.log(`[WebRTC] Connected to peer ${peerId}`)
      toast.success(`Connected to local peer (AirDrop active)`)
    }
    
    dc.onmessage = (e) => {
      // Handle incoming binary file chunks!
      if (e.data instanceof ArrayBuffer) {
        // In a full implementation, we reassemble chunks and save the Blob using FileSaver
        console.log(`[WebRTC] Received chunk of ${e.data.byteLength} bytes`)
      }
    }
  }

  const updatePeersState = () => {
    setActivePeers(Array.from(peersRef.current.keys()))
  }

  // Public API to broadcast a file
  const sendFileToAllPeers = (fileBuffer: ArrayBuffer) => {
    peersRef.current.forEach(peer => {
      if (peer.channel?.readyState === 'open') {
        peer.channel.send(fileBuffer)
      }
    })
  }

  return { activePeers, sendFileToAllPeers }
}
