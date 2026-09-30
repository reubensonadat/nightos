import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LoadingScreen } from '../../components/LoadingScreen'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function VenueRequired({ children }: { children: React.ReactNode }) {
  const { hasVenue, isInitializing } = useAuth()

  if (isInitializing) {
    return <LoadingScreen />
  }

  if (!hasVenue) {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}
