'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const router   = useRouter()
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
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, animation: 'fadeIn 0.5s ease-out' }}>
        {/* Full-bleed background */}
        <img
          src="/onboarding/welcome.jpg"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(0,0,0,0.04) 0%,rgba(0,0,0,0.28) 100%)' }} />

        {/* Glass card — bottom right, same style as onboarding */}
        <div style={{
          position: 'absolute', bottom: 40, right: 40,
          width: 420,
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.1)',
          padding: '32px 32px 28px',
          animation: 'slideUp 0.5s ease-out',
          color: '#111827',
        }}>
          {/* Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <rect x="42"  y="272" width="65" height="90"  rx="8" fill="white"/>
                <rect x="125" y="212" width="65" height="150" rx="8" fill="white"/>
                <rect x="208" y="155" width="65" height="207" rx="8" fill="white"/>
                <rect x="291" y="92"  width="65" height="270" rx="8" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#111827', letterSpacing: '-0.02em' }}>Apna Stocks</div>
              <div style={{ fontSize: '0.70rem', color: '#6b7280' }}>Your complete investment picture</div>
            </div>
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>Welcome back</h1>
          <p style={{ fontSize: '0.90rem', color: '#6b7280', marginBottom: 24 }}>Sign in to your portfolio dashboard</p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email address</label>
              <input
                id="email" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Password</label>
              <input
                id="password" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#dc2626', fontSize: '0.875rem', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              id="login-btn" type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
                boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', marginTop: 20 }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
          </p>
        </div>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(0,0,0,0.03)',
  color: '#111827', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
}
