import { useState, useRef } from 'react'
import { X, Camera, Save, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile, updatePassword } from '@/services/authService'
import { uploadAvatar } from '@/services/uploadService'
import { toast } from 'sonner'
import { Button, Input } from '@/components/ui/FormInputs'

interface ProfileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { user } = useAuth()
  
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [newPassword, setNewPassword] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen || !user) return null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const result = await uploadAvatar(file, user.id)
    setIsUploading(false)

    if (result.success && result.url) {
      setAvatarUrl(result.url)
      toast.success('Avatar uploaded successfully')
    } else {
      toast.error(result.error || 'Failed to upload avatar')
    }
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty')
      return
    }

    if (newPassword && newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsSaving(true)
    const { error } = await updateProfile({
      displayName: displayName.trim(),
      avatarUrl,
    })

    if (newPassword) {
      const { error: passErr } = await updatePassword(newPassword)
      if (passErr) {
        toast.error(`Failed to update password: ${passErr}`)
        setIsSaving(false)
        return
      }
    }
    setIsSaving(false)

    if (error) {
      toast.error(error)
    } else {
      toast.success('Profile updated successfully! (Refresh to see changes globally)')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl p-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Profile Settings</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div 
              className="relative w-24 h-24 rounded-full bg-[#18181b] border-2 border-white/10 flex items-center justify-center cursor-pointer group overflow-hidden"
              onClick={handleAvatarClick}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={40} className="text-slate-500" />
              )}
              
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                ) : (
                  <>
                    <Camera size={24} className="text-white mb-1" />
                    <span className="text-[10px] font-medium text-white">Change</span>
                  </>
                )}
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <p className="text-xs text-slate-500 mt-3 text-center">
              Recommended: Square image, at least 400x400px
            </p>
          </div>

          <div className="h-px w-full bg-white/5" />

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Display Name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you appear to others"
                className="bg-[#18181b] border-white/10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <Input
                value={user.email || 'Guest User'}
                disabled
                className="bg-[#18181b] border-white/10 opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Email address cannot be changed currently.
              </p>
            </div>

            <div className="h-px w-full bg-white/5 my-4" />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Change Password (Optional)
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="bg-[#18181b] border-white/10 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button 
              variant="secondary" 
              className="flex-1 bg-white/5 hover:bg-white/10 text-white border-0" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              className="flex-1 bg-blue-600 hover:bg-blue-700" 
              onClick={handleSave}
              isLoading={isSaving}
            >
              <Save size={18} className="mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
