'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="48" height="48" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="400" rx="72" fill="#244c89"/>
              <rect x="42"  y="272" width="65" height="90"  rx="10" fill="white"/>
              <rect x="125" y="212" width="65" height="150" rx="10" fill="white"/>
              <rect x="208" y="155" width="65" height="207" rx="10" fill="white"/>
              <rect x="291" y="92"  width="65" height="270" rx="10" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Apna Stocks</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>Your Portfolio Tracker</div>
          </div>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your portfolio dashboard</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--color-danger-bg)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger)',
              fontSize: '0.875rem',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="auth-link">Create one free</Link>
        </p>
      </div>
    </div>
  )
}
