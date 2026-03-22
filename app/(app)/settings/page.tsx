'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [email, setEmail]     = useState<string | null>(null)
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      // Check if user already has real data
      const { count } = await supabase.from('portfolio_transactions').select('id', { count: 'exact', head: true }).limit(1)
      setHasData((count ?? 0) > 0)
    })()
  }, [])

  const loadSampleData = async () => {
    if (!confirm('This will add sample securities, accounts, portfolios, and transactions. Continue?')) return
    setSeeding(true); setSeedMsg(null)
    try {
      const res = await fetch('/api/seed-sample-data', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setSeedMsg({ type: 'success', text: `✓ Sample data loaded — ${json.inserted.securities} securities and ${json.inserted.portfolios} portfolios added.` })
      setHasData(true)
    } catch (err: unknown) {
      setSeedMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setSeeding(false)
    }
  }

  const alertStyle = (type: 'success' | 'error') => ({
    padding: '10px 14px',
    background: type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
    border: `1px solid ${type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
    borderRadius: 'var(--radius-md)',
    color: type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
    fontSize: '0.875rem', marginBottom: 16, lineHeight: 1.6,
  })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Account preferences</p>
      </div>

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Account card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Account</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="text" className="form-input" value={email ?? '…'} disabled style={{ opacity: 0.6 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Base Currency</label>
              <input type="text" className="form-input" value="INR — Indian Rupee" disabled style={{ opacity: 0.75 }} />
              <div className="text-xs text-muted mt-2">The app is focused on Indian markets and uses INR throughout.</div>
            </div>
            <div className="text-sm text-muted">To change your password, sign out and use the reset password flow.</div>
          </div>
        </div>

        {/* Sample Data — only shown if no real data yet */}
        {hasData === false && (
          <div className="card">
            <div className="card-header"><span className="card-title">🧪 Sample Data</span></div>
            <div className="card-body">
              <p className="text-sm text-muted" style={{ lineHeight: 1.7, marginBottom: 16 }}>
                New here? Load a sample dataset to explore the app — includes securities, portfolios, and transactions.
              </p>
              {seedMsg && <div style={alertStyle(seedMsg.type)}>{seedMsg.text}</div>}
              <button id="load-sample-data-btn" className="btn btn-secondary" onClick={loadSampleData} disabled={seeding}>
                {seeding ? '⏳ Loading…' : '⬇ Load Sample Data'}
              </button>
              <div className="text-xs text-muted mt-2">Running more than once will create duplicate entries.</div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
