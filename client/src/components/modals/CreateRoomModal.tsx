import { useState } from 'react'
import { X } from 'lucide-react'
import { createRoom } from '@/services/roomService'
import { useAuth } from '@/hooks/useAuth'
import { useRoomStore } from '@/store/roomStore'
import { toast } from 'sonner'

interface CreateRoomModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (roomId: string) => void
}

export function CreateRoomModal({ isOpen, onClose, onCreated }: CreateRoomModalProps) {
  const { user } = useAuth()
  const addRoom = useRoomStore((s) => s.addRoom)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return

    setIsLoading(true)
    const { data, error } = await createRoom(user.id, name.trim(), description.trim() || undefined)
    setIsLoading(false)

    if (error || !data) {
      toast.error(error ?? 'Failed to create room')
      return
    }

    addRoom(data)
    toast.success(`Room "${data.name}" created!`)
    setName('')
    setDescription('')
    onClose()
    onCreated?.(data.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-md rounded-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#f4f4f5]">Create Room</h2>
            <p className="text-sm text-[#a1a1aa] mt-0.5">A room holds all events for a trip or occasion</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Room Name *</label>
            <input
              id="room-name"
              type="text"
              className="input-base"
              placeholder="e.g. Goa Trip 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              maxLength={80}
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              id="room-description"
              className="input-base resize-none"
              placeholder="What's this room for?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button
              id="create-room-submit"
              type="submit"
              className="btn-blue flex-1"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  Creating...
                </span>
              ) : (
                'Create Room'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
