import { useState } from 'react'
import { X } from 'lucide-react'
import { createRoom } from '@/services/roomService'
import { useAuth } from '@/hooks/useAuth'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useRoomStore } from '@/store/roomStore'
import { toast } from 'sonner'
import { generateSaltHex, hashPasswordForVerification, deriveKeyFromPassword } from '@/services/cryptoService'

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
  const [isVault, setIsVault] = useState(false)
  const [vaultPassword, setVaultPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const setVaultKey = useRoomStore((s) => s.setVaultKey)

  useEscapeKey(isOpen, onClose)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    if (isVault && vaultPassword.length < 6) {
      toast.error('Vault password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    let vaultSalt: string | undefined
    let vaultHash: string | undefined
    let derivedKey: CryptoKey | undefined

    if (isVault) {
      vaultSalt = await generateSaltHex()
      vaultHash = await hashPasswordForVerification(vaultPassword, vaultSalt)
      derivedKey = await deriveKeyFromPassword(vaultPassword, vaultSalt)
    }

    const { data, error } = await createRoom(
      user.id, 
      name.trim(), 
      description.trim() || undefined,
      isVault,
      vaultSalt,
      vaultHash
    )
    setIsLoading(false)

    if (error || !data) {
      toast.error(error ?? 'Failed to create room')
      return
    }

    if (isVault && derivedKey && data) {
      setVaultKey(data.id, derivedKey)
    }

    addRoom(data)
    toast.success(`Room "${data.name}" created!`)
    setName('')
    setDescription('')
    setIsVault(false)
    setVaultPassword('')
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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <input
              type="checkbox"
              id="is-vault"
              checked={isVault}
              onChange={(e) => setIsVault(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 bg-black/50"
            />
            <div className="flex-1">
              <label htmlFor="is-vault" className="text-sm font-medium text-white flex items-center gap-2">
                Enable Vault Mode 🔒
              </label>
              <p className="text-xs text-[#a1a1aa] mt-0.5">End-to-End Encrypt photos. No one can view them without the password.</p>
            </div>
          </div>

          {isVault && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="input-label text-rose-400">Vault Password *</label>
              <input
                type="password"
                className="input-base border-rose-500/30 focus:border-rose-500 focus:ring-rose-500/20"
                placeholder="Make it strong. If lost, files are gone forever."
                value={vaultPassword}
                onChange={(e) => setVaultPassword(e.target.value)}
                required={isVault}
                minLength={6}
              />
              <p className="text-xs text-rose-400/80 mt-1.5">
                We do not store this password. If you forget it, your photos cannot be recovered.
              </p>
            </div>
          )}

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
