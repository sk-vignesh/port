'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [email, setEmail]     = useState<string | null>(null)
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Groww integration state
  const [growwConnected, setGrowwConnected] = useState<boolean | null>(null)
  const [growwLastSync,  setGrowwLastSync]  = useState<string | null>(null)
  const [growwKey,       setGrowwKey]       = useState('')
  const [growwSecret,    setGrowwSecret]    = useState('')
  const [growwSaving,    setGrowwSaving]    = useState(false)
  const [growwMsg,       setGrowwMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      const { count } = await supabase.from('portfolio_transactions').select('id', { count: 'exact', head: true }).limit(1)
      setHasData((count ?? 0) > 0)
      const { data: intRow } = await supabase
        .from('user_integrations' as any).select('api_key, last_synced_at')
        .eq('integration_name', 'groww').maybeSingle()
      setGrowwConnected(!!intRow?.api_key)
      setGrowwLastSync(intRow?.last_synced_at ?? null)
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
    } finally { setSeeding(false) }
  }

  const saveGroww = async () => {
    if (!growwKey.trim() || !growwSecret.trim()) {
      setGrowwMsg({ type: 'error', text: 'Both TOTP Token and TOTP Secret are required.' }); return
    }
    setGrowwSaving(true); setGrowwMsg(null)
    try {
      const res = await fetch('/api/integrations/groww', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: growwKey, api_secret: growwSecret }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setGrowwConnected(true); setGrowwKey(''); setGrowwSecret('')
      setGrowwMsg({ type: 'success', text: '✓ Groww connected. Your portfolio will sync daily at 09:00 IST.' })
    } catch (err: unknown) {
      setGrowwMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally { setGrowwSaving(false) }
  }

  const disconnectGroww = async () => {
    if (!confirm('Disconnect Groww? Your synced data stays but no new syncs will run.')) return
    const res = await fetch('/api/integrations/groww', { method: 'DELETE' })
    if (res.ok) { setGrowwConnected(false); setGrowwMsg({ type: 'success', text: 'Groww disconnected.' }) }
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
        <p className="page-subtitle">Account preferences &amp; integrations</p>
      </div>

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Account */}
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

        {/* Groww Integration */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🌱 Groww Integration</span>
            {growwConnected && (
              <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.7rem' }}>
                ✓ Connected
              </span>
            )}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
              Connect your Groww account to automatically sync equity holdings and trades.
              Your credentials are stored securely in the database — never in GitHub or environment variables.
            </p>

            {growwMsg && <div style={alertStyle(growwMsg.type)}>{growwMsg.text}</div>}

            {growwConnected ? (
              <>
                {growwLastSync && (
                  <div className="text-xs text-muted">
                    Last synced: {new Date(growwLastSync).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={disconnectGroww} className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.5)' }}>
                    Disconnect
                  </button>
                </div>
                <div className="text-xs text-muted">To update credentials, disconnect and reconnect.</div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">TOTP Token (API Key)</label>
                  <input type="password" className="form-input" placeholder="eyJraWQi…"
                    value={growwKey} onChange={e => setGrowwKey(e.target.value)} autoComplete="off" />
                  <div className="text-xs text-muted mt-1">
                    From{' '}
                    <a href="https://groww.in/trade-api/api-keys" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent-light)' }}>
                      Groww Cloud API Keys
                    </a>{' '}
                    → Generate TOTP Token
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">TOTP Secret</label>
                  <input type="password" className="form-input" placeholder="Your TOTP secret"
                    value={growwSecret} onChange={e => setGrowwSecret(e.target.value)} autoComplete="off" />
                </div>
                <button onClick={saveGroww} className="btn btn-primary" disabled={growwSaving}>
                  {growwSaving ? '⏳ Saving…' : 'Connect Groww'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sample Data */}
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
