import { ShieldAlert } from 'lucide-react'

export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-white tracking-tight">System Offline</h1>
        <p className="text-white/60">
          CoGallery is currently undergoing scheduled maintenance or emergency upgrades. Please check back later.
        </p>
        
        <div className="pt-8 border-t border-white/10 text-xs text-white/30 font-mono">
          ERROR_SITE_MAINTENANCE_MODE_ENABLED
        </div>
      </div>
    </div>
  )
}
