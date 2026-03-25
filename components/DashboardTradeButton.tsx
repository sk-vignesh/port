'use client'

import { useState } from 'react'
import UnifiedTradeSearch from '@/components/UnifiedTradeSearch'

export default function DashboardTradeButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 22px', borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.875rem',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
          transition: 'all 0.2s',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.45)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)' }}
      >
        ↑↓ Record a Trade
      </button>
      <UnifiedTradeSearch open={open} onClose={() => setOpen(false)} />
    </>
  )
}
