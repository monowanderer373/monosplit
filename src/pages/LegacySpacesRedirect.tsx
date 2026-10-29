import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { legacySpaceDestination } from '../lib/spaceNavigation'
export default function LegacySpacesRedirect() {
  const location = useLocation(), { authUser, loading } = useAuth()
  if (loading) return null
  return <Navigate to={legacySpaceDestination(location.pathname, location.search, authUser?.id, authUser?.defaultCurrency)} replace />
}
