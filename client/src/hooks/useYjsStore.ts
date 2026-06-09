import { useState, useEffect, useRef } from 'react'
import { createTLStore, defaultShapeUtils, TLAnyShapeUtilConstructor, TLRecord, TLStoreWithStatus, TLInstancePresence } from 'tldraw'
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { supabase } from '@/lib/supabase'
import { saveCanvasState, loadCanvasState } from '@/services/canvasService'
import { uint8ToBase64, base64ToUint8 } from '@/utils/binary'

interface UseYjsStoreOptions {
  eventId: string
  userId: string
  shapeUtils?: TLAnyShapeUtilConstructor[]
  assets?: any // TLAssetStore
}
const DEFAULT_SHAPE_UTILS: TLAnyShapeUtilConstructor[] = []

export function useYjsStore({ eventId, userId, shapeUtils = DEFAULT_SHAPE_UTILS, assets }: UseYjsStoreOptions) {
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
      assets,
    })

    const channel = supabase.channel(`canvas:${eventId}`)

    // Helper to save binary state to Supabase DB
    const scheduleSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const stateUpdate = Y.encodeStateAsUpdate(yDoc)
        saveCanvasState(eventId, { yjsUpdate: uint8ToBase64(stateUpdate) }, userId)
      }, 5000)
    }

    // 2. Load Initial Data
    async function loadInitial() {
      try {
        const state = await loadCanvasState(eventId)
        if (state?.canvasData?.yjsUpdate) {
          Y.applyUpdate(yDoc, base64ToUint8(state.canvasData.yjsUpdate))
        }

        if (!isMounted) return

        // Sync loaded Yjs data to Tldraw Store
        store.mergeRemoteChanges(() => {
          const initialRecords: TLRecord[] = Array.from(yMap.values())
          
          // Sanitize records to prevent crashes from legacy or unknown shapes
          const validRecords = initialRecords.filter((record) => {
            if (record.typeName === 'shape') {
              const anyRecord = record as any
              // The legacy 'gallery-photo' shape crashes Tldraw v5 because the util is missing
              if (anyRecord.type === 'gallery-photo') {
                yMap.delete(record.id) // Clean it up from Yjs
                return false
              }
              // Also drop anything with missing typeName
              if (!anyRecord.type) {
                yMap.delete(record.id)
                return false
              }
            }
            return true
          })

          if (validRecords.length > 0) {
            try {
              store.put(validRecords)
            } catch (putErr) {
              console.error('Failed to parse Tldraw records from Yjs map. Resetting to prevent blank canvas:', putErr)
              yMap.clear() // Clear corrupt data so we can start fresh
            }
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
          Y.applyUpdate(yDoc, base64ToUint8(payload.update), 'supabase')
        } catch (err) {
          console.warn('Failed to apply remote Yjs update:', err)
        }
      })
      .on('broadcast', { event: 'yjs-awareness' }, ({ payload }) => {
        if (payload.senderId === userId) return
        try {
          awarenessProtocol.applyAwarenessUpdate(awareness, base64ToUint8(payload.update), 'supabase')
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
      
      channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: { senderId: userId, update: uint8ToBase64(update) },
      })
      scheduleSave()
    }
    yDoc.on('update', handleYjsUpdate)

    // 5. Bind local Awareness changes to Broadcast
    const handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
      if (origin === 'supabase') return
      
      const changedClients = added.concat(updated, removed)
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      
      channel.send({
        type: 'broadcast',
        event: 'yjs-awareness',
        payload: { senderId: userId, update: uint8ToBase64(update) },
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
          // Sanitize remote updates to prevent crashes
          const validUpdate = toUpdate.filter((record) => {
            if (record.typeName === 'shape') {
              const anyRecord = record as any
              if (anyRecord.type === 'gallery-photo' || !anyRecord.type) {
                return false // ignore it
              }
            }
            return true
          })

          if (validUpdate.length > 0) {
            try {
              store.put(validUpdate)
            } catch (putErr) {
              console.warn('Failed to apply remote Yjs records to Tldraw store:', putErr)
            }
          }
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
