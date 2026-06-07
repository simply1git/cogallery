import { supabase } from '@/lib/supabase'

export interface CanvasState {
  id: string
  eventId: string
  canvasData: any
  updatedAt: string
  updatedBy: string | null
}

/**
 * Load the canvas state for an event.
 * Returns null if no canvas exists yet.
 */
export async function loadCanvasState(eventId: string): Promise<CanvasState | null> {
  const { data, error } = await supabase
    .from('canvas_states')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load canvas state:', error)
    return null
  }

  if (!data) return null

  return {
    id: data.id,
    eventId: data.event_id,
    canvasData: data.canvas_data,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  }
}

/**
 * Save (upsert) the canvas state for an event.
 * Uses ON CONFLICT to create or update.
 */
export async function saveCanvasState(
  eventId: string,
  canvasData: any,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('canvas_states')
    .upsert(
      {
        event_id: eventId,
        canvas_data: canvasData,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: 'event_id' }
    )

  if (error) {
    console.error('Failed to save canvas state:', error)
    return { error: error.message }
  }

  return { error: null }
}
