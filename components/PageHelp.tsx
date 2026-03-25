'use client'

/**
 * PageHelp — A "?" button that opens a right-side help drawer.
 * Drop this into any page header to provide contextual guidance.
 *
 * Usage:
 *   <PageHelp pageId="dashboard" />
 */

import { useState } from 'react'
import { PAGE_HELP } from '@/lib/pageHelp'

export default function PageHelp({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false)
  const help = PAGE_HELP[pageId]
  if (!help) return null

  return (
    <>
      {/* ── ? Button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        title={`Help: ${help.title}`}
        aria-label="Open page help"
        style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-text-muted)',
          fontSize: '0.75rem', fontWeight: 800,
          cursor: 'pointer', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        ?
      </button>

      {/* ── Backdrop ───────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 1000,
          }}
        />
      )}

      {/* ── Drawer ────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={help.title}
        style={{
          position: 'fixed', top: 0, right: 0,
          width: 320, height: '100dvh',
          background: 'var(--color-bg-elevated)',
          borderLeft: '1px solid var(--color-border)',
          zIndex: 1001,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
          display: 'flex', flexDirection: 'column',
          boxShadow: open ? '-4px 0 24px rgba(0,0,0,0.25)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
            {help.title}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close help"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '1.1rem',
              lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {help.content.map((section, i) => (
              <div key={i}>
                <div style={{
                  fontWeight: 700, fontSize: '0.8rem', marginBottom: 6,
                  color: 'var(--color-accent-light)',
                }}>
                  {section.heading}
                </div>
                <div style={{
                  fontSize: '0.82rem', lineHeight: 1.75,
                  color: 'var(--color-text-secondary)',
                }}>
                  {section.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.72rem', color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}>
          Want more detail?{' '}
          <a href="/help" style={{ color: 'var(--color-accent-light)', textDecoration: 'none' }}>
            Open the full Help Centre →
          </a>
        </div>
      </div>
    </>
  )
}
