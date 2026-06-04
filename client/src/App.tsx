import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { RoomDetailPage } from '@/pages/RoomDetailPage'
import { EventDetailPage } from '@/pages/EventDetailPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { SeedboxBotPage } from '@/pages/SeedboxBotPage'
import { DeveloperDashboard } from '@/pages/DeveloperDashboard'
import { MaintenancePage } from '@/pages/MaintenancePage'
import { Layout } from '@/components/shared/Layout'
import { useAuth } from '@/hooks/useAuth'
import { uploadQueueService } from '@/services/uploadQueueService'
import { supabase } from '@/supabaseClient'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth()
  const location = useLocation()

  // Wait for auth to finish loading before making a decision
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin-slow" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    // Preserve the current URL so we can redirect back after login
    const returnTo = location.pathname + location.search
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected — hierarchy routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <ProtectedRoute>
            <RoomDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:roomId/event/:eventId"
        element={
          <ProtectedRoute>
            <EventDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Hidden Bot Route */}
      <Route
        path="/bot/seedbox"
        element={
          <ProtectedRoute>
            <SeedboxBotPage />
          </ProtectedRoute>
        }
      />

      {/* Hidden God Mode Dashboard */}
      <Route
        path="/developer"
        element={
          <ProtectedRoute>
            <DeveloperDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  const { isLoading } = useAuth()
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false)

  // Start processing the upload queue when the app loads
  useEffect(() => {
    uploadQueueService.startProcessing()
    return () => uploadQueueService.pauseProcessing()
  }, [])

  // Listen to Global Config for Panic Switches
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('global_config').select('maintenance_mode').single()
      if (data) setMaintenanceMode(data.maintenance_mode)
    }
    
    fetchConfig()

    const channel = supabase.channel('global_config_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_config' },
        (payload) => {
          if (payload.new && 'maintenance_mode' in payload.new) {
            setMaintenanceMode(payload.new.maintenance_mode)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin-slow" />
      </div>
    )
  }

  if (maintenanceMode) {
    return <MaintenancePage />
  }

  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        toastOptions={{
          style: {
            background: '#141414',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f4f4f5',
          },
        }}
      />
    </ThemeProvider>
  )
}

export default App
