'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [fontReady, setFontReady] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  // Wait for Montserrat to load before revealing the form
  useEffect(() => {
    // Explicitly load Montserrat and wait for it — document.fonts.ready
    // resolves immediately with display:swap (it considers fallback as "ready")
    document.fonts.load('600 16px Montserrat').then(() => {
      setFontReady(true)
    }).catch(() => {
      setFontReady(true) // show form anyway on error
    })
    // Safety fallback — show after 3s regardless
    const fallback = setTimeout(() => setFontReady(true), 3000)
    return () => clearTimeout(fallback)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes barGrow1 { from{height:0} to{height:60px} }
        @keyframes barGrow2 { from{height:0} to{height:100px} }
        @keyframes barGrow3 { from{height:0} to{height:140px} }
        @keyframes barGrow4 { from{height:0} to{height:180px} }
        @keyframes splashFadeOut {
          0%{opacity:1}
          80%{opacity:1}
          100%{opacity:0;pointer-events:none}
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, fontFamily: "'Montserrat', sans-serif" }}>
        {/* Full-bleed background */}
        <img
          src="/onboarding/welcome.jpg"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(0,0,0,0.10) 0%,rgba(0,0,0,0.45) 100%)' }} />

        {/* ── Splash screen — shows until font is ready ────────────── */}
        {!fontReady && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10001,
            background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 28,
          }}>
            {/* Animated bar chart icon */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
              {[
                { h: 60,  delay: '0s',    color: '#6366f1', anim: 'barGrow1' },
                { h: 100, delay: '0.15s', color: '#818cf8', anim: 'barGrow2' },
                { h: 140, delay: '0.3s',  color: '#a78bfa', anim: 'barGrow3' },
                { h: 180, delay: '0.45s', color: '#c4b5fd', anim: 'barGrow4' },
              ].map((bar, i) => (
                <div key={i} style={{
                  width: 32, borderRadius: 8,
                  background: `linear-gradient(to top, ${bar.color}, ${bar.color}99)`,
                  animation: `${bar.anim} 0.6s ease-out ${bar.delay} both`,
                  boxShadow: `0 0 20px ${bar.color}44`,
                }} />
              ))}
            </div>

            {/* Brand name — uses system font initially, that's fine since it's the splash */}
            <div style={{
              fontSize: '2rem', fontWeight: 800, color: '#ffffff',
              letterSpacing: '-0.03em',
              textShadow: '0 2px 12px rgba(99,102,241,0.5)',
              animation: 'fadeIn 0.5s ease-out 0.6s both',
            }}>
              Apna Stocks
            </div>

            {/* Loading indicator */}
            <div style={{
              fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)',
              animation: 'pulse 1.5s ease-in-out infinite',
              marginTop: 8,
            }}>
              Loading your portfolio…
            </div>
          </div>
        )}

        {/* ── Login card — only visible after font loads ──────────── */}
        {fontReady && (
          <div style={{
            position: 'absolute', bottom: 40, right: 40,
            width: 420,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            padding: '32px 32px 28px',
            animation: 'slideUp 0.5s ease-out',
            color: '#ffffff',
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
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff', letterSpacing: '-0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>Apna Stocks</div>
                <div style={{ fontSize: '0.70rem', color: 'rgba(255,255,255,0.7)' }}>Your complete investment picture</div>
              </div>
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>Welcome back</h1>
            <p style={{ fontSize: '0.90rem', color: 'rgba(255,255,255,0.75)', marginBottom: 24 }}>Sign in to your portfolio dashboard</p>

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
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#fca5a5', fontSize: '0.875rem', marginBottom: 16 }}>
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
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: 20 }}>
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" style={{ color: '#a5b4fc', fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
            </p>
          </div>
        )}
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textShadow: '0 1px 2px rgba(0,0,0,0.2)',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
  color: '#ffffff', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Montserrat', sans-serif",
}
