import { useEffect, useState, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { Layout } from '@/components/shared/Layout'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'
import { uploadQueueService } from '@/services/uploadQueueService'
import { supabase } from '@/lib/supabase'

// ─── Lazy-loaded pages (each becomes its own chunk) ─────────────────────────
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage').then(m => ({ default: m.RoomDetailPage })))
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage').then(m => ({ default: m.EventDetailPage })))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const SeedboxBotPage = lazy(() => import('@/pages/SeedboxBotPage').then(m => ({ default: m.SeedboxBotPage })))
const DeveloperDashboard = lazy(() => import('@/pages/DeveloperDashboard').then(m => ({ default: m.DeveloperDashboard })))
const MaintenancePage = lazy(() => import('@/pages/MaintenancePage').then(m => ({ default: m.MaintenancePage })))

// ─── Page loading fallback ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin-slow" />
    </div>
  )
}

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
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  )
}

function App() {
  const { isLoading: isAuthLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false)

  // Start processing the upload queue when the app loads
  useEffect(() => {
    uploadQueueService.init()
    setIsLoading(false)
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
        (payload: any) => {
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

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin-slow" />
      </div>
    )
  }

  if (maintenanceMode) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MaintenancePage />
      </Suspense>
    )
  }

  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
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
