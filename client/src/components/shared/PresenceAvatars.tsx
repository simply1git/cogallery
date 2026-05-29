import { PresenceUser } from '@/hooks/realtime/usePresence'

interface PresenceAvatarsProps {
  users: PresenceUser[]
  maxAvatars?: number
}

export function PresenceAvatars({ users, maxAvatars = 4 }: PresenceAvatarsProps) {
  if (!users || users.length === 0) return null

  const displayUsers = users.slice(0, maxAvatars)
  const remainingCount = Math.max(0, users.length - maxAvatars)

  return (
    <div className="flex items-center group cursor-pointer" title={users.map(u => u.displayName).join(', ')}>
      <div className="flex -space-x-2">
        {displayUsers.map((user, i) => (
          <div 
            key={user.id} 
            className="w-8 h-8 rounded-full border-2 border-[#09090b] overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-violet-600 shadow-md transition-transform duration-200 hover:z-10 hover:-translate-y-1 relative group/avatar"
            style={{ zIndex: 10 - i }}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-bold">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            
            {/* Online indicator */}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#09090b]" />
            
            {/* Tooltip */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              {user.displayName}
            </div>
          </div>
        ))}
        {remainingCount > 0 && (
          <div 
            className="w-8 h-8 rounded-full border-2 border-[#09090b] flex items-center justify-center bg-white/10 backdrop-blur-md text-white text-xs font-medium relative hover:z-10 transition-transform duration-200 hover:-translate-y-1"
            style={{ zIndex: 0 }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
      <div className="ml-3 flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">
            {users.length} {users.length === 1 ? 'person' : 'people'} here
          </span>
        </div>
      </div>
    </div>
  )
}
