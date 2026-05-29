import { useState } from 'react'
import { X, CalendarDays } from 'lucide-react'
import { createEvent } from '@/services/eventService'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import type { Event } from '@/types'

interface CreateEventModalProps {
  isOpen: boolean
  roomId: string
  onClose: () => void
  onCreated?: (event: Event) => void
}

export function CreateEventModal({ isOpen, roomId, onClose, onCreated }: CreateEventModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title.trim()) return

    setIsLoading(true)
    const { data, error } = await createEvent(roomId, title.trim(), description.trim() || undefined, user.id)
    setIsLoading(false)

    if (error || !data) {
      toast.error(error ?? 'Failed to create event')
      return
    }

    toast.success(`Event "${data.title}" created!`)
    setTitle('')
    setDescription('')
    onClose()
    onCreated?.(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-md rounded-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <CalendarDays size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#f4f4f5]">New Event</h2>
              <p className="text-sm text-[#a1a1aa]">A day, theme, or occasion in this room</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Event Title *</label>
            <input
              id="event-title"
              type="text"
              className="input-base"
              placeholder="e.g. Day 1 — Beach"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              maxLength={120}
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              id="event-description"
              className="input-base resize-none"
              placeholder="What happened here?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button
              id="create-event-submit"
              type="submit"
              className="btn-blue flex-1"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  Creating...
                </span>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
