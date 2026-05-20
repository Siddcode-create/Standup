import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          <span className="auth-brand__mark" aria-hidden="true">
            S
          </span>
          <span className="auth-brand__text">Smart Daily Standup</span>
        </Link>

        <header className="auth-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        {children}

        <footer className="auth-footer">{footer}</footer>
      </div>
    </div>
  )
}
