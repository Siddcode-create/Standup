import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <span className="app-loading__spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
