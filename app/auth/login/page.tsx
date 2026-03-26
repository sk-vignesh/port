'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── SVG Icons for social buttons ─────────────────────────────
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

export default function LoginPage() {
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [fontReady, setFontReady] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  // Splash: minimum 1.5s + wait for Montserrat
  useEffect(() => {
    const minDelay = new Promise(r => setTimeout(r, 1500))
    const fontLoad = document.fonts.load('600 16px Montserrat').catch(() => {})
    Promise.all([minDelay, fontLoad]).then(() => setFontReady(true))
    const fallback = setTimeout(() => setFontReady(true), 4000)
    return () => clearTimeout(fallback)
  }, [])

  const signInWithGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
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
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, fontFamily: "'Montserrat', sans-serif" }}>
        {/* Full-bleed background */}
        <img
          src="/onboarding/welcome.jpg"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(0,0,0,0.10) 0%,rgba(0,0,0,0.45) 100%)' }} />

        {/* ── Splash screen ─────────────────────────────────────── */}
        {!fontReady && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10001,
            background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 28,
          }}>
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
            <div style={{
              fontSize: '2rem', fontWeight: 800, color: '#ffffff',
              letterSpacing: '-0.03em',
              textShadow: '0 2px 12px rgba(99,102,241,0.5)',
              animation: 'fadeIn 0.5s ease-out 0.6s both',
            }}>
              Apna Stocks
            </div>
            <div style={{
              fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)',
              animation: 'pulse 1.5s ease-in-out infinite', marginTop: 8,
            }}>
              Loading your portfolio…
            </div>
          </div>
        )}

        {/* ── Glass card ────────────────────────────────────────── */}
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

            {/* ── Social login buttons ──────────────────────── */}
            <button onClick={signInWithGoogle} disabled={loading} style={{
              ...socialBtnStyle,
              background: '#ffffff', color: '#1f2937',
            }}>
              <GoogleIcon />
              Continue with Google
            </button>

            {/* ── Divider ──────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* ── Email/password — collapsed by default ───── */}
            {!showEmail ? (
              <button onClick={() => setShowEmail(true)} style={{
                ...socialBtnStyle,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M22 7l-10 7L2 7"/>
                </svg>
                Sign in with Email
              </button>
            ) : (
              <form onSubmit={handleEmailLogin} style={{ animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Email address</label>
                  <input
                    id="email" type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="off" autoFocus style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Password</label>
                  <input
                    id="password" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="new-password" style={inputStyle}
                  />
                </div>
                <button
                  id="login-btn" type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff', fontWeight: 700, fontSize: '0.92rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.8 : 1,
                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#fca5a5', fontSize: '0.85rem', marginTop: 12 }}>
                {error}
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginTop: 20 }}>
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" style={{ color: '#a5b4fc', fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
            </p>
          </div>
        )}
      </div>
    </>
  )
}

const socialBtnStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none',
  fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  fontFamily: "'Montserrat', sans-serif",
  transition: 'transform 0.15s, box-shadow 0.15s',
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
