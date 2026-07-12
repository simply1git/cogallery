import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon, Save, Camera, Trash2, Check, Settings, UserPlus, Sliders, BarChart3, Upload } from 'lucide-react'
import { updateRoom, updateRoomThumbnail } from '@/services/roomService'
import { uploadThumbnail } from '@/services/uploadService'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { toastError, toastSuccess } from '@/lib/toast'
import type { Room } from '@/types'
import { PermissionSelector } from '@/components/permissions/PermissionSelector'

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
  const [activeTab, setActiveTab] = useState<'general' | 'permissions'>('general')

  // Permission states - initialize with room's current permissions or defaults
  const [permissions, setPermissions] = useState({
    canUpload: room.permissions?.canUpload ?? true,
    canDeleteOwn: room.permissions?.canDeleteOwn ?? true,
    canDeleteOthers: room.permissions?.canDeleteOthers ?? (room.isVault ? false : true),
    canInvite: room.permissions?.canInvite ?? true,
    canManageEvents: room.permissions?.canManageEvents ?? true,
    canChangeSettings: room.permissions?.canChangeSettings ?? true,
    canViewAnalytics: room.permissions?.canViewAnalytics ?? true
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEscapeKey(isOpen, onClose)

  // Update permissions if room changes
  useEffect(() => {
    setPermissions({
      canUpload: room.permissions?.canUpload ?? true,
      canDeleteOwn: room.permissions?.canDeleteOwn ?? true,
      canDeleteOthers: room.permissions?.canDeleteOthers ?? (room.isVault ? false : true),
      canInvite: room.permissions?.canInvite ?? true,
      canManageEvents: room.permissions?.canManageEvents ?? true,
      canChangeSettings: room.permissions?.canChangeSettings ?? true,
      canViewAnalytics: room.permissions?.canViewAnalytics ?? true
    })
  }, [room])

  if (!isOpen) return null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadThumbnail(file, room.id)
      setIsUploading(false)

      if (result.success && result.url) {
        setThumbnailUrl(result.url)
        await updateRoomThumbnail(room.id, result.url)
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
      const { error } = await updateRoomThumbnail(room.id, null)
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
    if (!name.trim()) {
      toastError('Room name cannot be empty')
      return
    }

    setIsSaving(true)
    const updates = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions
    }

    try {
      const { error } = await updateRoom(room.id, updates)
      setIsSaving(false)

      if (error) {
        throw error
      }

      toastSuccess('Room settings saved')
      onUpdate(updates)
      onClose()
    } catch (err) {
      setIsSaving(false)
      toastError('Failed to save room settings')
    }
  }

  const handleSavePermissions = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateRoom(room.id, { permissions })
      if (error) {
        throw error
      }
      toastSuccess('Permissions updated successfully')
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
        <div className="relative w-full max-w-[500px] glass-md rounded-2xl p-4 sm:p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#f4f4f5]">Room Settings</h2>
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
                      <img src={thumbnailUrl} alt="Room Cover" className="relative w-full h-full object-contain drop-shadow-lg" />
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
            </>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-white mb-4">Access Permissions</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Customize what members can do in this room. Changes apply to all existing and future members.
                </p>
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-500/20 rounded-lg">
                        <Upload size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Upload Media</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to upload photos and videos</p>
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
                          <span className="pointer-none block h-full w-full leading-none flex items-center justify-center text-xs font-medium">
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
                          <span className="pointer-none block h-full w-full leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canDeleteOwn ? '✓' : ''}
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
                        <h4 className="font-medium text-white">Delete Others' Media</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to delete uploads by others</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canDeleteOthers}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canDeleteOthers: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canDeleteOthers ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-green-500/20 rounded-lg">
                        <UserPlus size={16} className="text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Invite Members</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to invite new people</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canInvite}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canInvite: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canInvite ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-purple-500/20 rounded-lg">
                        <Settings size={16} className="text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Manage Events</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to create and edit events</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canManageEvents}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canManageEvents: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canManageEvents ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-500/20 rounded-lg">
                        <Sliders size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Change Settings</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to modify room settings</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canChangeSettings}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canChangeSettings: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canChangeSettings ? '✓' : ''}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-500/20 rounded-lg">
                        <BarChart3 size={16} className="text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">View Analytics</h4>
                        <p className="text-xs text-[#a1a1aa]">Allow members to view room statistics</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.canViewAnalytics}
                          onChange={(e) => setPermissions(prev => ({
                            ...prev,
                            canViewAnalytics: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 bg-white/10 rounded rounded-lg border border-white/20">
                          <span className="pointer-none block h-full w-foot leading-none flex items-center justify-center text-xs font-medium">
                            {permissions.canViewAnalytics ? '✓' : ''}
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
                      <span>Current Mode:</span>
                      <span className="font-medium">
                        {Object.values(permissions).every(v => v === true) ? 'Full Access' :
                         Object.values(permissions).every(v => v === false) ? 'No Access' : 'Custom'}
                      </span>
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