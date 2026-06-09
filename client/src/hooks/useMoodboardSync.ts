import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { saveCanvasState, loadCanvasState } from '@/services/canvasService'

export interface CanvasItem {
  id: string
  type?: 'photo' | 'sticky' | 'emoji' | 'path'
  photoId?: string
  text?: string
  color?: string
  pathData?: string
  strokeColor?: string
  strokeWidth?: number
  x: number
  y: number
  w: number
  h: number
  zIndex: number
}

export interface CanvasCursor {
  userId: string
  userName: string
  x: number
  y: number
  color: string
}

export function useMoodboardSync(eventId: string, userId: string, userName: string) {
  const [items, setItems] = useState<Record<string, CanvasItem>>({})
  const [cursors, setCursors] = useState<Record<string, CanvasCursor>>({})
  const [isLoading, setIsLoading] = useState(true)
  
  const itemsRef = useRef(items)
  itemsRef.current = items

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const userColor = useRef('#'+Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')).current

  const scheduleSave = useCallback((currentItems: Record<string, CanvasItem>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveCanvasState(eventId, { items: currentItems }, userId)
    }, 2000)
  }, [eventId, userId])

  useEffect(() => {
    let isMounted = true

    async function init() {
      const state = await loadCanvasState(eventId)
      if (state?.canvasData?.items && isMounted) {
        setItems(state.canvasData.items)
      }
      if (isMounted) setIsLoading(false)
    }

    init()

    const channel = supabase.channel(`moodboard:${eventId}`, {
      config: {
        broadcast: { ack: false }
      }
    })
    
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'update_item' }, ({ payload }) => {
        if (payload.userId === userId) return
        setItems(prev => ({ ...prev, [payload.item.id]: payload.item }))
      })
      .on('broadcast', { event: 'delete_item' }, ({ payload }) => {
        if (payload.userId === userId) return
        setItems(prev => {
          const next = { ...prev }
          delete next[payload.id]
          return next
        })
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (payload.userId === userId) return
        setCursors(prev => ({ ...prev, [payload.userId]: payload.cursor }))
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [eventId, userId])

  const updateItem = useCallback((item: CanvasItem) => {
    setItems(prev => {
      const next = { ...prev, [item.id]: item }
      scheduleSave(next)
      return next
    })
    channelRef.current?.send({
      type: 'broadcast',
      event: 'update_item',
      payload: { userId, item }
    })
  }, [userId, scheduleSave])

  const deleteItem = useCallback((id: string) => {
    setItems(prev => {
      const next = { ...prev }
      delete next[id]
      scheduleSave(next)
      return next
    })
    channelRef.current?.send({
      type: 'broadcast',
      event: 'delete_item',
      payload: { userId, id }
    })
  }, [userId, scheduleSave])

  const updateCursor = useCallback((x: number, y: number) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { userId, cursor: { userId, userName, x, y, color: userColor } }
    })
  }, [userId, userName, userColor])

  return {
    items,
    cursors,
    isLoading,
    updateItem,
    deleteItem,
    updateCursor
  }
}
