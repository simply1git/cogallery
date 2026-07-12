import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon, Save, Camera, Trash2, Check, Settings, Upload, UserPlus } from 'lucide-react'
import { updateEvent, updateEventThumbnail } from '@/services/eventService'
import { uploadThumbnail } from '@/services/uploadService'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { toastError, toastSuccess } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import type { EventWithDetails } from '@/types'

interface EventSettingsModalProps {
  isOpen: boolean
  event: EventWithDetails
  onClose: () => void
  onUpdate: (updatedEvent: Partial<EventWithDetails>) => void
}

export function EventSettingsModal({ isOpen, event, onClose, onUpdate }: EventSettingsModalProps) {
  const [title, setTitle] = useState(event.title || '')
  const [description, setDescription] = useState(event.description || '')
   const [thumbnailUrl, setThumbnailUrl] = useState(event.thumbnailUrl || '')

   const [isUploading, setIsUploading] = useState(false)
   const [isSaving, setIsSaving] = useState(false)
   const [activeTab, setActiveTab] = useState<'general' | 'permissions'>('general')

   // Permission states - initialize with event's current permissions or defaults
   const [permissions, setPermissions] = useState({
     canUpload: event.permissions?.canUpload ?? true,
     canDeleteOwn: event.permissions?.canDeleteOwn ?? true,
     canDeleteOthers: event.permissions?.canDeleteOthers ?? false, // Events typically don't allow deleting others' content by default
     canInvite: event.permissions?.canInvite ?? false,       // Invitations usually handled at room level
     canManageEvent: event.permissions?.canManageEvent ?? true,
     canChangeSettings: event.permissions?.canChangeSettings ?? true,
     canViewAttendance: event.permissions?.canViewAttendance ?? true
   })

   // For inheritance awareness: load room permissions to show as reference
   const [roomPermissions, setRoomPermissions] = useState({
     canUpload: true,
     canDeleteOwn: true,
     canDeleteOthers: false,
     canInvite: false,
     canManageEvent: true,
     canChangeSettings: true,
     canViewAttendance: true
   })
   const [roomId, setRoomId] = useState<string | null>(event.roomId)
   const [isLoadingRoom, setIsLoadingRoom] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEscapeKey(isOpen, onClose)

  // Load room permissions for inheritance awareness
  useEffect(() => {
    if (!event.roomId) {
      setIsLoadingRoom(false)
      return
    }

    const loadRoomPermissions = async () => {
      setIsLoadingRoom(true)
      try {
        const { data: roomData, error } = await supabase
          .from('rooms')
          .select('permissions')
          .eq('id', event.roomId)
          .single()

        if (error) throw error

        if (roomData?.permissions) {
          setRoomPermissions(roomData.permissions)
        }
      } catch (err) {
        console.warn('Failed to load room permissions for inheritance:', err)
        // Use defaults if we can't load
        setRoomPermissions({
          canUpload: true,
          canDeleteOwn: true,
          canDeleteOthers: false,
          canInvite: false,
          canManageEvent: true,
          canChangeSettings: true,
          canViewAttendance: true
        })
      } finally {
        setIsLoadingRoom(false)
      }
    }

    loadRoomPermissions()
  }, [event.roomId])

  if (!isOpen) return null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadThumbnail(file, event.id)
      setIsUploading(false)

      if (result.success && result.url) {
        setThumbnailUrl(result.url)
        await updateEventThumbnail(event.id, result.url)
        onUpdate({ thumbnailUrl: result.url })
        toastSuccess('Cover uploaded successfully')
      } else {
        toastError(result.error || 'Failed to upload cover')
      }
    } catch (err) {
      setIsUploading(false)
      toastError('Upload failed')
    }
  }

  const handleDeleteThumbnail = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsUploading(true)
    try {
      const { error } = await updateEventThumbnail(event.id, null)
      setIsUploading(false)

      if (!error) {
        setThumbnailUrl('')
        onUpdate({ thumbnailUrl: undefined })
        toastSuccess('Cover removed successfully')
      } else {
        toastError(error)
      }
    } catch (err) {
      setIsUploading(false)
      toastError('Failed to remove cover')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toastError('Event title cannot be empty')
      return
    }

    setIsSaving(true)
    const updates = {
      title: title.trim(),
      description: description.trim() || undefined,
      permissions
    }

    try {
      const { error } = await updateEvent(event.id, updates)
      setIsSaving(false)

      if (error) {
        throw error
      }

      toastSuccess('Event settings saved')
      onUpdate(updates)
      onClose()
    } catch (err) {
      setIsSaving(false)
      toastError('Failed to save event settings')
    }
  }

  const handleSavePermissions = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateEvent(event.id, { permissions })
      if (error) {
        throw error
      }
      toastSuccess('Event permissions updated successfully')
    } catch (error) {
      toastError('Failed to update permissions')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md glass-md rounded-2xl p-4 sm:p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#f4f4f5]">Event Settings</h2>
            <button onClick={onClose} className="btn-icon"><X size={18} /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-3 text-center font-medium ${
                activeTab === 'general'
                  ? 'border-b-2 border-primary-500 text-white'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex-1 py-3 text-center font-medium ${
                activeTab === 'permissions'
                  ? 'border-b-2 border-primary-500 text-white'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Permissions
            </button>
          </div>

          {activeTab === 'general' && (
            <>
              <div className="mb-6 flex flex-col items-center">
                <div
                  onClick={handleAvatarClick}
                  className="group relative w-full h-40 rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:border-white/20"
                >
                  {thumbnailUrl ? (
                    <>
                      <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60" />
                      <img src={thumbnailUrl} alt="Event Cover" className="relative w-full h-full object-contain drop-shadow-lg" />
                      <button
                        type="button"
                        onClick={handleDeleteThumbnail}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition-colors z-10"
                        title="Remove Cover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
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
                  <label className="input-label">Event Title</label>
                  <input
                    type="text"
                    className="input-base"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Day 1: Beach"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="input-label">Description (Optional)</label>
                  <textarea
                    className="input-base min-h-[80px] resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add some details about this event..."
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
                    disabled={isSaving || isUploading || !title.trim()}
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
            </>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-white mb-4">Event Permissions</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Customize what members can do in this event. Note: Some permissions may be inherited from room settings.
                </p>
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-500/20 rounded-lg">
                        <Upload size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Upload Media</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to upload photos and videos to this event</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canUpload}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canUpload: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canUpload ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-red-500/20 rounded-lg">
                        <Trash2 size={16} className="text-red-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Delete Own Media</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to delete their own uploads</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canDeleteOwn}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canDeleteOwn: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canDeleteOwn ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="w-8 h-8 flex items-center justify-center bg-green-500/20 rounded-lg">
                      <UserPlus size={16} className="text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Invite Members</h4>
                      <p className="text-xs text-[#a1a1aa]">Allow members to invite new people to this event</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-purple-500/20 rounded-lg">
                        <Settings size={16} className="text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Manage Event Settings</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to edit event details and settings</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canManageEvent}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canManageEvent: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canManageEvent ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-500/20 rounded-lg">
                        <Check size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">View Attendance</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to see who's attending</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canViewAttendance}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canViewAttendance: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canViewAttendance ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-white/5 rounded-lg">
                  <h4 className="font-medium text-white mb-3">Permission Summary</h4>
                  <div className="text-xs text-[#a1a1aa] space-y-1">
                    <div className="flex justify-between">
                      <span>Enabled Permissions:</span>
                      <span className="font-mono">{Object.values(permissions).filter(Boolean).length}/7</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Note:</span>
                      <span className="font-medium text-[#a1a1aa]">Some permissions may be overridden by room-level settings</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSavePermissions}
                  className="btn-primary px-6 py-3"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save size={16} />
                      Save Permissions
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}