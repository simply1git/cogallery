import { useState, useRef } from 'react'
import { X, Image as ImageIcon, Save, Trash2, Camera } from 'lucide-react'
import { updateRoom, updateRoomThumbnail } from '@/services/roomService'
import { uploadThumbnail } from '@/services/uploadService'
import { toast } from 'sonner'
import type { Room } from '@/types'

interface RoomSettingsModalProps {
  isOpen: boolean
  room: Room
  onClose: () => void
  onUpdate: (updatedRoom: Partial<Room>) => void
}

export function RoomSettingsModal({ isOpen, room, onClose, onUpdate }: RoomSettingsModalProps) {
  const [name, setName] = useState(room.name || '')
  const [description, setDescription] = useState(room.description || '')
  const [thumbnailUrl, setThumbnailUrl] = useState(room.thumbnailUrl || '')
  
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    // Upload to photos bucket /thumbnails/roomId
    const result = await uploadThumbnail(file, room.id)
    setIsUploading(false)

    if (result.success && result.url) {
      setThumbnailUrl(result.url)
      // Save it immediately so it persists
      await updateRoomThumbnail(room.id, result.url)
      onUpdate({ thumbnailUrl: result.url })
      toast.success('Cover uploaded successfully')
    } else {
      toast.error(result.error || 'Failed to upload cover')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Room name cannot be empty')
      return
    }

    setIsSaving(true)
    const updates = { 
      name: name.trim(), 
      description: description.trim() || undefined 
    }
    
    const { error } = await updateRoom(room.id, updates)
    setIsSaving(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success('Room settings saved')
    onUpdate(updates)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-md rounded-2xl p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#f4f4f5]">Room Settings</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        <div className="mb-6 flex flex-col items-center">
          <div 
            onClick={handleAvatarClick}
            className="group relative w-full h-40 rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:border-white/20"
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Room Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-[#71717a]">
                <ImageIcon size={32} className="mb-2 opacity-50" />
                <span className="text-sm">Upload Cover</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
              ) : (
                <Camera size={24} className="text-white drop-shadow-md" />
              )}
            </div>
          </div>
          <input 
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <p className="text-xs text-[#71717a] mt-2 text-center">
            Click to upload a custom cover image
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="input-label">Room Name</label>
            <input
              type="text"
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hawaii Trip 2024"
              maxLength={50}
            />
          </div>

          <div>
            <label className="input-label">Description (Optional)</label>
            <textarea
              className="input-base min-h-[80px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add some details about this room..."
              maxLength={200}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-blue flex-1"
              disabled={isSaving || isUploading || !name.trim()}
            >
              {isSaving ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <Save size={16} />
                  Save Changes
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
