'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import UnifiedTradeSearch from '@/components/UnifiedTradeSearch'

const SKIP_PATHS = ['/onboard', '/auth']

export default function QuickTradeButton() {
  const pathname = usePathname()
  const [open,        setOpen]        = useState(false)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (SKIP_PATHS.some(p => pathname.startsWith(p))) return null

  const openSearch = () => { setOpen(false); setSearchOpen(true) }

  return (
    <>
      <div ref={ref} style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1000 }}>
        {/* Menu */}
        {open && (
          <div style={{
            position: 'absolute', bottom: 64, right: 0,
            background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
            borderRadius: 14, padding: 8, minWidth: 210,
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', gap: 4,
            animation: 'fadeUp 0.15s ease',
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', padding: '4px 10px 6px' }}>
              Quick Action
            </div>

            {/* Record Trade — opens UnifiedTradeSearch */}
            <button
              onClick={openSearch}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 9, textDecoration: 'none', background: 'rgba(99,102,241,0.12)',
                border: 'none', width: '100%', cursor: 'pointer', transition: 'background 0.1s',
              }}
            >
              <span style={{ fontSize: '0.9rem', width: 18, textAlign: 'center', color: '#818cf8', fontWeight: 800 }}>↑↓</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>Record a Trade</span>
            </button>

            {/* New Portfolio */}
            <Link href="/portfolios/new" onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 9, textDecoration: 'none', background: 'var(--color-bg-input)',
                transition: 'background 0.1s',
              }}>
              <span style={{ fontSize: '0.9rem', width: 18, textAlign: 'center', color: 'var(--color-accent-light)', fontWeight: 800 }}>＋</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>New Portfolio</span>
            </Link>

            {/* Import CSV */}
            <Link href="/import" onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 9, textDecoration: 'none', background: 'var(--color-bg-input)',
                transition: 'background 0.1s',
              }}>
              <span style={{ fontSize: '0.9rem', width: 18, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 800 }}>⬆</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>Import CSV</span>
            </Link>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setOpen(v => !v)}
          title="Quick Trade"
          style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: open
              ? 'var(--color-bg-elevated)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: open ? 'var(--color-text-primary)' : '#fff',
            fontSize: open ? '1.3rem' : '1.5rem', fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: open ? '0 2px 12px rgba(0,0,0,0.2)' : '0 6px 24px rgba(99,102,241,0.5)',
            transition: 'all 0.2s',
            transform: open ? 'rotate(45deg)' : 'none',
          }}
        >
          {open ? '✕' : '↑↓'}
        </button>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {/* Unified Trade Search modal */}
      <UnifiedTradeSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
