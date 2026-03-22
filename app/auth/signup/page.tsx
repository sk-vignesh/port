'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card text-center">
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account.
          </p>
          <div className="mt-4">
            <Link href="/auth/login" className="btn btn-secondary">Back to Login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">📈</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Portfolio Performance</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>Investment Tracker</div>
          </div>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start tracking your investments today — free</p>

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="signup-password"
              type="password"
              className="form-input"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm password</label>
            <input
              id="signup-confirm"
              type="password"
              className="form-input"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
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
            id="signup-btn"
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-muted mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
