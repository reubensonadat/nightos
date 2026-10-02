import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, sectorPath } from '../../context/AuthContext'
import { LoadingScreen } from '../../components/LoadingScreen'

export function ProtectedRoute({
  roles,
  children,
}: {
  /** When set, only these roles may load this subtree (e.g. manager app). */
  roles?: string[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, isInitializing, role, staffSession, venue } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Role gate: staff who escalate the URL into another sector are bounced
  // straight back to their own designated screen.
  if (roles && roles.length > 0) {
    const r = staffSession?.role || role
    if (!r || !roles.includes(r)) {
      return <Navigate to={r ? sectorPath(r, staffSession?.venue_slug || venue?.slug) : '/login'} replace />
    }
  }

  return <>{children}</>
}

export function VenueRequired({ children }: { children: React.ReactNode }) {
  const { hasVenue, venue, isInitializing } = useAuth()

  if (isInitializing) {
    return <LoadingScreen />
  }

  if (!hasVenue && !venue && !localStorage.getItem('nightos:active_venue_id')) {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}
