import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { saveCanvasState, loadCanvasState } from '@/services/canvasService'
import type { Editor, TLRecord } from 'tldraw'
import * as Y from 'yjs'

interface UseCanvasSyncOptions {
  eventId: string
  userId: string
  editor: Editor | null
}

/**
 * Syncs tldraw canvas state across multiple users via Supabase Realtime and Yjs.
 * 
 * Architecture:
 * - tldraw records are bound to a Yjs Y.Map via two-way sync.
 * - Yjs binary updates are broadcasted via Supabase Realtime.
 * - This provides mathematical CRDT conflict resolution (zero race conditions).
 */
export function useCanvasSync({ eventId, userId, editor }: UseCanvasSyncOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Yjs document references
  const yDocRef = useRef<Y.Doc | null>(null)
  const yMapRef = useRef<Y.Map<TLRecord> | null>(null)

  // Initialize Yjs and load initial state
  useEffect(() => {
    if (!editor) return

    let isMounted = true
    const yDoc = new Y.Doc()
    const yMap = yDoc.getMap<TLRecord>('records')
    yDocRef.current = yDoc
    yMapRef.current = yMap

    async function loadInitial() {
      const state = await loadCanvasState(eventId)
      
      if (state?.canvasData?.yjsUpdate) {
        // Decode base64 to Uint8Array and apply
        try {
          const binaryString = atob(state.canvasData.yjsUpdate)
          const len = binaryString.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          Y.applyUpdate(yDoc, bytes)
        } catch (err) {
          console.error('Failed to load Yjs binary state', err)
        }
      }

      // Sync initial Yjs state to tldraw
      if (!isMounted) return
      
      editor!.store.mergeRemoteChanges(() => {
        const initialRecords: TLRecord[] = Array.from(yMap.values())
        if (initialRecords.length > 0) {
          editor!.store.put(initialRecords)
        }
      })
    }

    loadInitial()

    return () => {
      isMounted = false
      yDoc.destroy()
    }
  }, [editor, eventId])

  // Debounced save of Yjs binary state
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const yDoc = yDocRef.current
      if (!yDoc) return
      
      const stateUpdate = Y.encodeStateAsUpdate(yDoc)
      
      // Convert Uint8Array to base64 string for JSONB storage
      let binaryString = ''
      for (let i = 0; i < stateUpdate.length; i++) {
        binaryString += String.fromCharCode(stateUpdate[i])
      }
      const base64Update = btoa(binaryString)
      
      saveCanvasState(eventId, { yjsUpdate: base64Update }, userId)
    }, 5000)
  }, [eventId, userId])

  // Set up Tldraw <-> Yjs bindings and Supabase Realtime transport
  useEffect(() => {
    if (!editor) return
    const yDoc = yDocRef.current
    const yMap = yMapRef.current
    if (!yDoc || !yMap) return

    const channelName = `canvas:${eventId}`
    const channel = supabase.channel(channelName)

    // 1. Receive binary updates from other users via Supabase
    channel
      .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
        if (payload.senderId === userId) return // Ignore own broadcast
        
        try {
          const binaryString = atob(payload.update)
          const len = binaryString.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          // Apply to Yjs, which will trigger the yMap observer
          Y.applyUpdate(yDoc, bytes, 'supabase')
        } catch (err) {
          console.warn('Failed to apply remote Yjs update:', err)
        }
      })
      .subscribe()

    channelRef.current = channel

    // 2. Broadcast local Yjs binary updates to other users
    const handleYjsUpdate = (update: Uint8Array, origin: any) => {
      // Don't broadcast updates that we just received from supabase!
      if (origin === 'supabase') return
      
      let binaryString = ''
      for (let i = 0; i < update.length; i++) {
        binaryString += String.fromCharCode(update[i])
      }
      const base64Update = btoa(binaryString)

      channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: {
          senderId: userId,
          update: base64Update,
        },
      })

      scheduleSave()
    }
    yDoc.on('update', handleYjsUpdate)

    // 3. Bind Yjs Map changes -> Tldraw Store
    const handleYMapObserve = (event: Y.YMapEvent<TLRecord>, transaction: Y.Transaction) => {
      if (transaction.origin === 'tldraw') return // Avoid infinite loop
      
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
        editor.store.mergeRemoteChanges(() => {
          if (toUpdate.length > 0) editor.store.put(toUpdate)
          if (toRemove.length > 0) editor.store.remove(toRemove as any)
        })
      }
    }
    yMap.observe(handleYMapObserve)

    // 4. Bind Tldraw Store changes -> Yjs Map
    const unsubTldraw = editor.store.listen(
      ({ changes }) => {
        yDoc.transact(() => {
          Object.values(changes.added).forEach((r) => {
            if (r.typeName === 'shape' || r.typeName === 'page' || r.typeName === 'asset') {
              yMap.set(r.id, r as TLRecord)
            }
          })
          Object.values(changes.updated).forEach(([, r]) => {
            if (r.typeName === 'shape' || r.typeName === 'page' || r.typeName === 'asset') {
              yMap.set(r.id, r as TLRecord)
            }
          })
          Object.values(changes.removed).forEach((r) => {
            yMap.delete(r.id)
          })
        }, 'tldraw')
      },
      { source: 'user', scope: 'document' }
    )

    return () => {
      unsubTldraw()
      yMap.unobserve(handleYMapObserve)
      yDoc.off('update', handleYjsUpdate)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [editor, eventId, userId, scheduleSave])
}
