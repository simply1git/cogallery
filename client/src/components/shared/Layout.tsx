import { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'
import { ProfileSettingsModal } from '@/components/modals/ProfileSettingsModal'
import { useState } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0a0a] text-[#f4f4f5] transition-colors pb-[70px] md:pb-0">
      <Header onOpenProfile={() => setIsProfileOpen(true)} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <BottomNav onOpenProfile={() => setIsProfileOpen(true)} />
      
      <ProfileSettingsModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  )
}
