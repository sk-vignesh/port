'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from './ThemeProvider'
import Link from 'next/link'

const THEME_OPTIONS = [
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
] as const

export default function TopBar({ email }: { email: string | null }) {
  const { theme, setTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = email
    ? email.split('@')[0].slice(0, 2).toUpperCase()
    : '??'

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 90,
      height: 56,
      background: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 24,
      gap: 8,
      backdropFilter: 'blur(12px)',
    }}>
      {/* Theme switcher */}
      <div style={{
        display: 'flex',
        background: 'var(--color-bg-input)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 3,
        gap: 2,
      }}>
        {THEME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            style={{
              width: 32,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: theme === opt.value ? 'var(--color-accent-glow)' : 'transparent',
              color: theme === opt.value ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
              outline: theme === opt.value ? '1px solid rgba(59,130,246,0.3)' : 'none',
            }}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      {/* Profile button + dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setProfileOpen(p => !p)}
          title={email ?? 'Profile'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: profileOpen ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none',
            transition: 'box-shadow 0.2s',
          }}
        >
          {initials}
        </button>

        {profileOpen && (
          <div style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 220,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            animation: 'slideUp 0.15s ease',
            zIndex: 200,
          }}>
            {/* User info */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)', marginBottom: 2 }}>
                {email?.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {email}
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '6px 0' }}>
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>⚙️</span> Settings
              </Link>
              <button
                onClick={signOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.875rem',
                  color: 'var(--color-danger)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>🚪</span> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
