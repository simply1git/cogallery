import { useState } from 'react'
import { X, UserPlus, Check, ShieldCheck, Edit, Upload, Trash2, MessageCircle, Users, Settings, Sliders, BarChart3 } from 'lucide-react'

export type UserRole = 'owner' | 'editor' | 'viewer'

export interface PermissionDetails {
  canUpload: boolean
  canDeleteOwn: boolean
  canDeleteOthers: boolean
  canInvite: boolean
  canManageEvents: boolean
  canChangeSettings: boolean
  canViewAnalytics: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, PermissionDetails> = {
  owner: {
    canUpload: true,
    canDeleteOwn: true,
    canDeleteOthers: true,
    canInvite: true,
    canManageEvents: true,
    canChangeSettings: true,
    canViewAnalytics: true
  },
  editor: {
    canUpload: true,
    canDeleteOwn: true,
    canDeleteOthers: false,
    canInvite: false,
    canManageEvents: true,
    canChangeSettings: false,
    canViewAnalytics: true
  },
  viewer: {
    canUpload: false,
    canDeleteOwn: false,
    canDeleteOthers: false,
    canInvite: false,
    canManageEvents: false,
    canChangeSettings: false,
    canViewAnalytics: true
  }
}

interface PermissionSelectorProps {
  value: UserRole | null
  onChange: (role: UserRole | null) => void
  disabled?: boolean
  showDetails?: boolean
}

export function PermissionSelector({ value, onChange, disabled = false, showDetails = true }: PermissionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleRoleSelect = (role: UserRole) => {
    setIsOpen(false)
    if (!disabled) {
      onChange(role)
    }
  }

  const getPermissionSummary = (role: UserRole) => {
    const perms = ROLE_PERMISSIONS[role]
    const count = Object.values(perms).filter(Boolean).length
    return `${count}/7 permissions`
  }

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-4 py-3 border border-white/10 rounded-lg
          bg-[#09090b]/80 backdrop-blur-sm hover:bg-white/10 transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex-1 flex items-center gap-3">
          {value ? (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-500/20">
                {value === 'owner' ? <ShieldCheck size={16} className="text-primary-400" />
                  : value === 'editor' ? <Edit size={16} className="text-primary-400" />
                    : <Users size={16} className="text-primary-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#f4f4f5] truncate">
                  {value === 'owner' ? 'Owner' : value === 'editor' ? 'Editor' : 'Viewer'}
                </p>
                <p className="text-xs text-[#71717a]">{getPermissionSummary(value)}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/20">
                <Users size={16} className="text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#f4f4f5] truncate">Select Role</p>
                <p className="text-xs text-[#71717a]">Choose permissions</p>
              </div>
            </>
          )}
        </div>
        <span className="transition-transform duration-200">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {!disabled && isOpen && (
        <div className="absolute z-20 mt-1 w-full max-w-xl border border-white/10 rounded-lg bg-[#09090b]/80 backdrop-blur-sm shadow-lg z-[50]">
          <div className="space-y-4">
            {Object.entries(ROLE_PERMISSIONS).map(([roleKey, perms]) => {
              const role = roleKey as UserRole
              const isSelected = value === role

              return (
                <div
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`
                    flex items-start gap-4 px-4 py-3 border-b last:border-b-0
                    hover:bg-white/10 transition-colors cursor-pointer
                    ${isSelected ? 'border-l-4 border-primary-500 bg-white/5' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center">
                    {role === 'owner' ? <ShieldCheck size={18} className="text-primary-400" />
                      : role === 'editor' ? <Edit size={18} className="text-primary-400" />
                        : <Users size={18} className="text-primary-400" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium text-[#f4f4f5]">
                        {role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer'}
                      </h3>
                      <span className="text-xs text-[#71717a]">
                        {Object.values(perms).filter(Boolean).length}/7 permissions
                      </span>
                    </div>
                    {showDetails && (
                      <div className="text-xs text-[#a1a1aa] space-y-1">
                        {perms.canUpload && <div className="flex items-center gap-2">
                          <Upload size={14} className="text-green-400" />
                          <span>Can upload media</span>
                        </div>}
                        {perms.canDeleteOwn && <div className="flex items-center gap-2">
                          <Trash2 size={14} className="text-green-400" />
                          <span>Can delete own media</span>
                        </div>}
                        {perms.canDeleteOthers && <div className="flex items-center gap-2">
                          <Trash2 size={14} className="text-red-400" />
                          <span>Can delete others' media</span>
                        </div>}
                        {perms.canInvite && <div className="flex items-center gap-2">
                          <UserPlus size={14} className="text-green-400" />
                          <span>Can invite members</span>
                        </div>}
                        {perms.canManageEvents && <div className="flex items-center gap-2">
                          <Settings size={14} className="text-green-400" />
                          <span>Can manage events</span>
                        </div>}
                        {perms.canChangeSettings && <div className="flex items-center gap-2">
                          <Sliders size={14} className="text-green-400" />
                          <span>Can change settings</span>
                        </div>}
                        {perms.canViewAnalytics && <div className="flex items-center gap-2">
                          <BarChart3 size={14} className="text-green-400" />
                          <span>Can view analytics</span>
                        </div>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {showDetails && (
            <div className="pt-3 px-4 border-t border-white/10">
              <p className="text-xs text-[#71717a] text-center">
                Owner: Full control • Editor: Can upload and manage events • Viewer: View-only access
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}