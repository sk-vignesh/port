'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SampleDataBanner() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const load = async () => {
    if (!confirm('Load sample data? This adds Apple, BASF, Vanguard ETF, accounts, portfolios, and transactions.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seed-sample-data', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setDone(true)
      setTimeout(() => router.refresh(), 800)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.08) 100%)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>✓</span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>Sample data loaded!</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Refreshing dashboard…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px 28px',
      marginBottom: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 36 }}>🧪</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)', marginBottom: 4 }}>
            Get started with sample data
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: 480 }}>
            Load Apple, BASF &amp; Vanguard ETF with real price history, two portfolios, and 2 years of transactions — so you can explore every feature right away.
          </div>
          {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: 6 }}>{error}</div>}
        </div>
      </div>
      <button
        onClick={load}
        disabled={loading}
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: '12px 24px',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          opacity: loading ? 0.7 : 1,
          boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
          transition: 'all 0.2s',
        }}
      >
        {loading ? '⏳ Loading…' : '⬇ Load Sample Data'}
      </button>
    </div>
  )
}
