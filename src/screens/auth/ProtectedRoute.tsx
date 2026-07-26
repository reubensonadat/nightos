import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-isabelline">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-licorice/20 border-t-licorice" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function VenueRequired({ children }: { children: React.ReactNode }) {
  const { hasVenue, isInitializing } = useAuth()

  if (isInitializing) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-isabelline">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-licorice/20 border-t-licorice" />
      </div>
    )
  }

  if (!hasVenue) {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}
