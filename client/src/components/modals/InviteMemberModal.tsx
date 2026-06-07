import { useState } from 'react'
import { X, UserPlus, Copy, Check, QrCode } from 'lucide-react'
import { addMemberByEmail } from '@/services/roomService'
import { useAuth } from '@/hooks/useAuth'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { toast } from 'sonner'
import type { UserRole } from '@/types'
import { QRCodeSVG } from 'qrcode.react'
import { addEventMemberByEmail } from '@/services/eventService'
import { motion, AnimatePresence } from 'framer-motion'
import { useHaptics } from '@/hooks/useHaptics'

interface InviteMemberModalProps {
  isOpen: boolean
  roomId: string
  eventId?: string
  roomName: string
  onClose: () => void
}

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'editor', label: 'Editor', desc: 'Can upload photos & videos' },
  { value: 'viewer', label: 'Viewer', desc: 'Can view only, cannot upload' },
]

export function InviteMemberModal({ isOpen, roomId, eventId, roomName, onClose }: InviteMemberModalProps) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('editor')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const { haptic } = useHaptics()

  const shareUrl = eventId 
    ? `${window.location.origin}/room/${roomId}/event/${eventId}`
    : `${window.location.origin}/room/${roomId}`

  useEscapeKey(isOpen, onClose)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !email.trim()) return

    setIsLoading(true)
    let error = null
    if (eventId) {
      const res = await addEventMemberByEmail(eventId, email.trim().toLowerCase(), role as 'editor' | 'viewer')
      error = res.error
    } else {
      const res = await addMemberByEmail(roomId, email.trim().toLowerCase(), role, user.id)
      error = res.error
    }
    setIsLoading(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(`Invited ${email} as ${role}`)
    setEmail('')
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    haptic('success')
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                haptic('medium')
                onClose()
              }
            }}
            className="relative w-full max-w-md glass-md rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto pb-safe sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle (Mobile Only) */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5 sm:hidden" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                  <UserPlus size={20} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#f4f4f5]">
                    {eventId ? 'Invite to Event' : 'Invite to Room'}
                  </h2>
                  <p className="text-sm text-[#a1a1aa] truncate max-w-[180px]">{roomName}</p>
                </div>
              </div>
              <button onClick={() => { haptic('light'); onClose() }} className="btn-icon"><X size={18} /></button>
            </div>

            {/* Share link & QR */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="input-label mb-0">Share Link</label>
                <button 
                  onClick={() => { haptic('light'); setShowQR(!showQR) }}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <QrCode size={14} />
                  {showQR ? 'Hide QR' : 'Show QR'}
                </button>
              </div>
              
              <AnimatePresence>
                {showQR && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex justify-center mb-4 p-4 bg-white rounded-xl mt-2">
                      <QRCodeSVG 
                        value={shareUrl}
                        size={160}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="Q"
                        includeMargin={false}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex gap-2 mt-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="input-base flex-1 text-sm text-[#71717a] cursor-default"
                />
                <button onClick={copyLink} className="btn-secondary px-3 flex-shrink-0">
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="divider mb-5" />

            {/* Invite by email */}
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="input-label">Invite by Email</label>
                <input
                  id="invite-email"
                  type="email"
                  className="input-base"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus={window.innerWidth > 640} // Don't autofocus on mobile to prevent keyboard popping up immediately
                />
              </div>

              <div>
                <label className="input-label">Role</label>
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { haptic('light'); setRole(opt.value) }}
                      className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                        role === opt.value
                          ? 'border-blue-500/50 bg-blue-500/10 text-[#f4f4f5]'
                          : 'border-white/8 bg-white/3 text-[#a1a1aa] hover:border-white/15'
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-[#71717a] mt-0.5">{opt.desc}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={() => { haptic('light'); onClose() }}>Cancel</button>
                <button
                  id="invite-submit"
                  type="submit"
                  className="btn-blue flex-1"
                  disabled={isLoading || !email.trim()}
                  onClick={() => haptic('medium')}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                      Sending...
                    </span>
                  ) : (
                    'Send Invite'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
