import { useState, useEffect, useRef } from 'react'
import { createTLStore, defaultShapeUtils, TLAnyShapeUtilConstructor, TLRecord, TLStoreWithStatus, TLInstancePresence } from 'tldraw'
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { supabase } from '@/lib/supabase'
import { saveCanvasState, loadCanvasState } from '@/services/canvasService'

interface UseYjsStoreOptions {
  eventId: string
  userId: string
  shapeUtils?: TLAnyShapeUtilConstructor[]
}

export function useYjsStore({ eventId, userId, shapeUtils = [] }: UseYjsStoreOptions) {
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: 'loading'
  })

  // Timer for debouncing database saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let isMounted = true

    // 1. Initialize Yjs, Awareness, and Tldraw Store
    const yDoc = new Y.Doc()
    const yMap = yDoc.getMap<TLRecord>('records')
    const awareness = new awarenessProtocol.Awareness(yDoc)
    
    const store = createTLStore({
      shapeUtils: [...defaultShapeUtils, ...shapeUtils],
    })

    const channel = supabase.channel(`canvas:${eventId}`)

    // Helper to save binary state to Supabase DB
    const scheduleSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const stateUpdate = Y.encodeStateAsUpdate(yDoc)
        let binaryString = ''
        for (let i = 0; i < stateUpdate.length; i++) {
          binaryString += String.fromCharCode(stateUpdate[i])
        }
        const base64Update = btoa(binaryString)
        saveCanvasState(eventId, { yjsUpdate: base64Update }, userId)
      }, 5000)
    }

    // 2. Load Initial Data
    async function loadInitial() {
      try {
        const state = await loadCanvasState(eventId)
        if (state?.canvasData?.yjsUpdate) {
          const binaryString = atob(state.canvasData.yjsUpdate)
          const len = binaryString.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          Y.applyUpdate(yDoc, bytes)
        }

        if (!isMounted) return

        // Sync loaded Yjs data to Tldraw Store
        store.mergeRemoteChanges(() => {
          const initialRecords: TLRecord[] = Array.from(yMap.values())
          if (initialRecords.length > 0) {
            store.put(initialRecords)
          }
        })

        // Ready!
        setStoreWithStatus({ status: 'synced-remote', connectionStatus: 'online', store })

      } catch (err) {
        console.error('Failed to load canvas state:', err)
        if (isMounted) setStoreWithStatus({ status: 'error', error: err as Error })
      }
    }

    // 3. Setup Supabase Realtime Transport
    channel
      .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
        if (payload.senderId === userId) return
        try {
          const binaryString = atob(payload.update)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          Y.applyUpdate(yDoc, bytes, 'supabase')
        } catch (err) {
          console.warn('Failed to apply remote Yjs update:', err)
        }
      })
      .on('broadcast', { event: 'yjs-awareness' }, ({ payload }) => {
        if (payload.senderId === userId) return
        try {
          const binaryString = atob(payload.update)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          awarenessProtocol.applyAwarenessUpdate(awareness, bytes, 'supabase')
        } catch (err) {
          console.warn('Failed to apply remote awareness update:', err)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadInitial()
        }
      })

    // 4. Bind local Yjs doc changes to Broadcast
    const handleYjsUpdate = (update: Uint8Array, origin: any) => {
      if (origin === 'supabase') return
      
      let binaryString = ''
      for (let i = 0; i < update.length; i++) {
        binaryString += String.fromCharCode(update[i])
      }
      
      channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: { senderId: userId, update: btoa(binaryString) },
      })
      scheduleSave()
    }
    yDoc.on('update', handleYjsUpdate)

    // 5. Bind local Awareness changes to Broadcast
    const handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
      if (origin === 'supabase') return
      
      const changedClients = added.concat(updated, removed)
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      
      let binaryString = ''
      for (let i = 0; i < update.length; i++) {
        binaryString += String.fromCharCode(update[i])
      }

      channel.send({
        type: 'broadcast',
        event: 'yjs-awareness',
        payload: { senderId: userId, update: btoa(binaryString) },
      })
    }
    awareness.on('update', handleAwarenessUpdate)

    // 6. Two-way bindings between Tldraw Store and Yjs Map
    
    // Tldraw -> Yjs (Document changes & Presence)
    const unsubTldraw = store.listen(
      ({ changes }) => {
        // Document Changes
        yDoc.transact(() => {
          Object.values(changes.added).forEach((r) => {
            if (['shape', 'page', 'asset', 'document', 'camera', 'pointer'].includes(r.typeName)) {
              yMap.set(r.id, r as TLRecord)
            }
          })
          Object.values(changes.updated).forEach(([, r]) => {
            if (['shape', 'page', 'asset', 'document', 'camera', 'pointer'].includes(r.typeName)) {
              yMap.set(r.id, r as TLRecord)
            }
          })
          Object.values(changes.removed).forEach((r) => {
            if (yMap.has(r.id)) {
              yMap.delete(r.id)
            }
          })
        }, 'tldraw')

        // Presence Changes (Cursors)
        const presenceChanges = Object.values(changes.added)
          .concat(Object.values(changes.updated).map(([, r]) => r))
          .filter(r => r.typeName === 'instance_presence') as TLInstancePresence[]
          
        if (presenceChanges.length > 0) {
          awareness.setLocalStateField('presence', presenceChanges[0])
        }
      },
      { source: 'user', scope: 'all' } // sync both document and presence!
    )

    // Yjs Map -> Tldraw (Remote Document Changes)
    const handleYMapObserve = (event: Y.YMapEvent<TLRecord>, transaction: Y.Transaction) => {
      if (transaction.origin === 'tldraw') return
      
      const toUpdate: TLRecord[] = []
      const toRemove: string[] = []

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const record = yMap.get(key)
          if (record) toUpdate.push(record)
        } else if (change.action === 'delete') {
          toRemove.push(key)
        }
      })

      if (toUpdate.length > 0 || toRemove.length > 0) {
        store.mergeRemoteChanges(() => {
          if (toUpdate.length > 0) store.put(toUpdate)
          if (toRemove.length > 0) store.remove(toRemove as any)
        })
      }
    }
    yMap.observe(handleYMapObserve)

    // Awareness -> Tldraw (Remote Cursors)
    const handleAwarenessChange = () => {
      const states = awareness.getStates()
      const presences: TLInstancePresence[] = []
      states.forEach((state: any, clientId: any) => {
        if (clientId !== awareness.clientID && state.presence) {
          presences.push(state.presence)
        }
      })
      if (presences.length > 0) {
        store.mergeRemoteChanges(() => {
          store.put(presences)
        })
      }
    }
    awareness.on('change', handleAwarenessChange)

    return () => {
      isMounted = false
      unsubTldraw()
      yMap.unobserve(handleYMapObserve)
      awareness.off('change', handleAwarenessChange)
      awareness.off('update', handleAwarenessUpdate)
      yDoc.off('update', handleYjsUpdate)
      supabase.removeChannel(channel)
      yDoc.destroy()
    }
  }, [eventId, userId, shapeUtils])

  return storeWithStatus
}
