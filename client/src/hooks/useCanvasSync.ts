import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { saveCanvasState, loadCanvasState } from '@/services/canvasService'
import type { Editor } from 'tldraw'

interface UseCanvasSyncOptions {
  eventId: string
  userId: string
  editor: Editor | null
}

/**
 * Syncs tldraw canvas state across multiple users via Supabase Realtime.
 * 
 * Architecture:
 * - Each user broadcasts their local changes to a Supabase Realtime channel
 * - Other users receive the broadcast and apply changes to their local editor
 * - The full canvas snapshot is auto-saved to the DB every 10 seconds (debounced)
 * - On mount, the canvas loads the last saved snapshot from the DB
 */
export function useCanvasSync({ eventId, userId, editor }: UseCanvasSyncOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRemoteUpdateRef = useRef(false)
  const hasLoadedRef = useRef(false)

  // Load initial canvas state from database
  useEffect(() => {
    if (!editor || hasLoadedRef.current) return

    async function loadInitial() {
      const state = await loadCanvasState(eventId)
      if (state?.canvasData && editor) {
        try {
          isRemoteUpdateRef.current = true
          const snapshot = state.canvasData
          if (snapshot.records && Array.isArray(snapshot.records)) {
            // Load shapes from the saved snapshot
            editor.store.mergeRemoteChanges(() => {
              for (const record of snapshot.records) {
                if (editor.store.has(record.id as any)) {
                  editor.store.update(record.id as any, () => record)
                } else {
                  editor.store.put([record])
                }
              }
            })
          }
        } catch (err) {
          console.warn('Failed to restore canvas state:', err)
        } finally {
          isRemoteUpdateRef.current = false
        }
      }
      hasLoadedRef.current = true
    }

    loadInitial()
  }, [editor, eventId])

  // Debounced save to database
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!editor) return
      const allRecords = editor.store.allRecords()
      // Only save shape/page records, not ephemeral stuff like cursors
      const persistable = allRecords.filter(
        (r: any) => r.typeName === 'shape' || r.typeName === 'page' || r.typeName === 'asset'
      )
      saveCanvasState(eventId, { records: persistable }, userId)
    }, 5000)
  }, [editor, eventId, userId])

  // Set up Supabase Realtime channel for live sync
  useEffect(() => {
    if (!editor) return

    const channelName = `canvas:${eventId}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'canvas-change' }, ({ payload }) => {
        if (payload.senderId === userId) return // Ignore own changes
        if (!editor) return

        try {
          isRemoteUpdateRef.current = true
          editor.store.mergeRemoteChanges(() => {
            if (payload.added) {
              editor.store.put(payload.added)
            }
            if (payload.updated) {
              for (const record of payload.updated) {
                if (editor.store.has(record.id as any)) {
                  editor.store.update(record.id as any, () => record)
                } else {
                  editor.store.put([record])
                }
              }
            }
            if (payload.removed) {
              const ids = payload.removed
                .map((r: any) => r.id)
                .filter((id: any) => editor.store.has(id as any))
              if (ids.length > 0) {
                editor.store.remove(ids as any[])
              }
            }
          })
        } catch (err) {
          console.warn('Failed to apply remote canvas change:', err)
        } finally {
          isRemoteUpdateRef.current = false
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // Presence sync for multiplayer cursors is handled by tldraw's built-in system
      })
      .subscribe()

    channelRef.current = channel

    // Listen to local store changes and broadcast them
    const unsub = editor.store.listen(
      ({ changes }) => {
        if (isRemoteUpdateRef.current) return // Don't re-broadcast remote changes

        const added = Object.values(changes.added).filter(
          (r: any) => r.typeName === 'shape' || r.typeName === 'asset'
        )
        const updated = Object.values(changes.updated).map(([, to]: any) => to).filter(
          (r: any) => r.typeName === 'shape' || r.typeName === 'asset'
        )
        const removed = Object.values(changes.removed).filter(
          (r: any) => r.typeName === 'shape' || r.typeName === 'asset'
        )

        if (added.length === 0 && updated.length === 0 && removed.length === 0) return

        channel.send({
          type: 'broadcast',
          event: 'canvas-change',
          payload: {
            senderId: userId,
            added: added.length > 0 ? added : undefined,
            updated: updated.length > 0 ? updated : undefined,
            removed: removed.length > 0 ? removed : undefined,
          },
        })

        // Schedule a debounced save
        scheduleSave()
      },
      { source: 'user', scope: 'document' }
    )

    return () => {
      unsub()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [editor, eventId, userId, scheduleSave])
}
