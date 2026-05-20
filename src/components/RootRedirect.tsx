import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <span className="app-loading__spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}
