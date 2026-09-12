import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../../../shared/types/platform.types'
import { useAuth } from '../model/AuthContext'

interface ProtectedRouteProps extends PropsWithChildren {
  roles: UserRole[]
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/auth/login?next=${next}`} replace />
  }

  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
  return children
}
