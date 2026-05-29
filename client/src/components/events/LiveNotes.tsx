import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { updateEvent } from '@/services/eventService'
import { toast } from 'sonner'
import { Users, FileText, Loader2 } from 'lucide-react'

interface LiveNotesProps {
  eventId: string
  initialNotes: string
}

export function LiveNotes({ eventId, initialNotes }: LiveNotesProps) {
  const { user } = useAuth()
  const [notes, setNotes] = useState(initialNotes || '')
  const [isSaving, setIsSaving] = useState(false)
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // We debounce the save to the database to avoid spamming updates
  const saveNotes = useCallback(async (text: string) => {
    setIsSaving(true)
    const { error } = await updateEvent(eventId, { notes: text })
    if (error) {
      toast.error('Failed to save notes')
    }
    setIsSaving(false)
  }, [eventId])

  useEffect(() => {
    if (!eventId || !user) return

    // 1. Create a channel for this specific event's notes
    const channel = supabase.channel(`event-notes-${eventId}`)

    // 2. Listen for text broadcast from others
    channel.on(
      'broadcast',
      { event: 'notes-update' },
      ({ payload }) => {
        // Only update if the payload is from another user
        if (payload.userId !== user.id) {
          setNotes(payload.text)
        }
      }
    )

    // 3. Track presence specifically in the notes view
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const users = new Set<string>()
      for (const id in state) {
        // @ts-ignore
        if (state[id][0]?.userId) users.add(state[id][0].userId)
      }
      setActiveUsers(users)
    })

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: user.id })
      }
    })

    return () => {
      channel.unsubscribe()
    }
  }, [eventId, user])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setNotes(text)

    // Broadcast to others
    if (user) {
      supabase.channel(`event-notes-${eventId}`).send({
        type: 'broadcast',
        event: 'notes-update',
        payload: { text, userId: user.id },
      })
    }

    // Auto-save logic (debounced)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(text)
    }, 2000)
  }

  return (
    <div className="bg-[#18181b] rounded-2xl border border-white/10 p-6 shadow-xl animate-scale-in">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-blue-400 font-semibold">
          <FileText size={18} />
          Live Notes
        </div>
        
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users size={14} />
            {activeUsers.size} viewing
          </span>
          <span className="flex items-center gap-1.5 w-16 justify-end">
            {isSaving ? (
              <span className="flex items-center gap-1 text-blue-400"><Loader2 size={12} className="animate-spin" /> Saving</span>
            ) : (
              'Saved'
            )}
          </span>
        </div>
      </div>

      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Type shared itineraries, links, or notes here... Everyone in this event will see it instantly!"
        className="w-full h-[60vh] bg-transparent text-[#f4f4f5] resize-none focus:outline-none placeholder:text-slate-600 leading-relaxed font-mono text-[15px]"
        spellCheck={false}
      />
    </div>
  )
}
