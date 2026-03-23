'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function SettingsContent() {
  const searchParams  = useSearchParams()
  const [email, setEmail]     = useState<string | null>(null)
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Groww
  const [growwConnected, setGrowwConnected] = useState<boolean | null>(null)
  const [growwLastSync,  setGrowwLastSync]  = useState<string | null>(null)
  const [growwKey,       setGrowwKey]       = useState('')
  const [growwSecret,    setGrowwSecret]    = useState('')
  const [growwSaving,    setGrowwSaving]    = useState(false)
  const [growwMsg,       setGrowwMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Zerodha
  const [zerodhaConnected,  setZerodhaConnected]  = useState<boolean | null>(null)
  const [zerodhaLastSync,   setZerodhaLastSync]   = useState<string | null>(null)
  const [zerodhaTokenDate,  setZerodhaTokenDate]  = useState<string | null>(null)
  const [zerodhaName,       setZerodhaName]        = useState<string | null>(null)
  const [zerodhaMsg,        setZerodhaMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  // Token is stale if generated before today's 6am IST
  const isTokenStale = (tokenDate: string | null) => {
    if (!tokenDate) return true
    const IST_OFFSET = 5.5 * 60 * 60 * 1000
    const now = new Date()
    const todayIST = new Date(now.getTime() + IST_OFFSET)
    todayIST.setUTCHours(0, 30, 0, 0) // 06:00 IST = 00:30 UTC
    return new Date(tokenDate) < todayIST
  }

  useEffect(() => {
    // Handle callback result from Zerodha OAuth
    const z = searchParams.get('zerodha')
    if (z === 'success') setZerodhaMsg({ type: 'success', text: '✓ Zerodha connected successfully!' })
    if (z === 'error')   setZerodhaMsg({ type: 'error',   text: 'Zerodha connection failed. Please try again.' });

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      const { count } = await supabase.from('portfolio_transactions').select('id', { count: 'exact', head: true }).limit(1)
      setHasData((count ?? 0) > 0)

      const { data: integrations } = await (supabase as any)
        .from('user_integrations').select('integration_name, api_key, last_synced_at, meta')

      for (const row of integrations ?? []) {
        if (row.integration_name === 'groww') {
          setGrowwConnected(!!row.api_key); setGrowwLastSync(row.last_synced_at)
        }
        if (row.integration_name === 'zerodha') {
          setZerodhaConnected(!!row.api_key); setZerodhaLastSync(row.last_synced_at)
          setZerodhaTokenDate(row.meta?.token_date ?? null)
          setZerodhaName(row.meta?.kite_user_name ?? null)
        }
      }
    })()
  }, [searchParams])

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
      setGrowwMsg({ type: 'success', text: '✓ Groww connected. Portfolio syncs daily at 09:00 IST.' })
    } catch (err: unknown) {
      setGrowwMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally { setGrowwSaving(false) }
  }

  const disconnectGroww = async () => {
    if (!confirm('Disconnect Groww? Your synced data stays but no new syncs will run.')) return
    const res = await fetch('/api/integrations/groww', { method: 'DELETE' })
    if (res.ok) { setGrowwConnected(false); setGrowwMsg({ type: 'success', text: 'Groww disconnected.' }) }
  }

  const disconnectZerodha = async () => {
    if (!confirm('Disconnect Zerodha? Your synced data stays but no new syncs will run.')) return
    const res = await fetch('/api/integrations/zerodha', { method: 'DELETE' })
    if (res.ok) { setZerodhaConnected(false); setZerodhaMsg({ type: 'success', text: 'Zerodha disconnected.' }) }
  }

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

  const alert = (type: 'success' | 'error') => ({
    padding: '10px 14px',
    background: type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
    border: `1px solid ${type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
    borderRadius: 'var(--radius-md)', color: type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
    fontSize: '0.875rem', marginBottom: 16, lineHeight: 1.6,
  })

  const connectedBadge = (
    <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.7rem' }}>
      ✓ Connected
    </span>
  )
  const staleBadge = (
    <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.7rem' }}>
      ⚠ Token expired
    </span>
  )

  const zerodhaStale = zerodhaConnected && isTokenStale(zerodhaTokenDate)

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

        {/* Groww */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🌱 Groww</span>
            {growwConnected && connectedBadge}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
              Syncs equity holdings and trades automatically. Uses your TOTP token — fully automated, no daily re-login needed.
            </p>
            {growwMsg && <div style={alert(growwMsg.type)}>{growwMsg.text}</div>}
            {growwConnected ? (
              <>
                {growwLastSync && <div className="text-xs text-muted">Last synced: {new Date(growwLastSync).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                <button onClick={disconnectGroww} className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.5)', alignSelf: 'flex-start' }}>
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">TOTP Token (API Key)</label>
                  <input type="password" className="form-input" placeholder="eyJraWQi…" value={growwKey} onChange={e => setGrowwKey(e.target.value)} autoComplete="off" />
                  <div className="text-xs text-muted mt-1">
                    From <a href="https://groww.in/trade-api/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-light)' }}>Groww Cloud API Keys</a> → Generate TOTP Token
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">TOTP Secret</label>
                  <input type="password" className="form-input" placeholder="Your TOTP secret" value={growwSecret} onChange={e => setGrowwSecret(e.target.value)} autoComplete="off" />
                </div>
                <button onClick={saveGroww} className="btn btn-primary" disabled={growwSaving} style={{ alignSelf: 'flex-start' }}>
                  {growwSaving ? '⏳ Saving…' : 'Connect Groww'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Zerodha */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Zerodha Kite</span>
            {zerodhaConnected && !zerodhaStale && connectedBadge}
            {zerodhaStale && staleBadge}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
              Syncs your Kite holdings and trades. Requires a one-click login once per day — Kite tokens expire at 06:00 IST.
            </p>
            {zerodhaMsg && <div style={alert(zerodhaMsg.type)}>{zerodhaMsg.text}</div>}
            {zerodhaConnected && !zerodhaStale ? (
              <>
                {zerodhaName && <div className="text-xs text-muted">Logged in as <strong>{zerodhaName}</strong></div>}
                {zerodhaLastSync && <div className="text-xs text-muted">Last synced: {new Date(zerodhaLastSync).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href="/api/integrations/zerodha/connect" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
                    🔄 Refresh Token
                  </a>
                  <button onClick={disconnectZerodha} className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.5)' }}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : zerodhaStale ? (
              <>
                <div className="text-sm" style={{ color: '#f59e0b', lineHeight: 1.6 }}>
                  Your Kite token expired at 06:00 IST. Click below to log in again — takes 10 seconds.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href="/api/integrations/zerodha/connect" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    🔑 Refresh Kite Login
                  </a>
                  <button onClick={disconnectZerodha} className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.5)' }}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <a href="/api/integrations/zerodha/connect" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Connect Zerodha
              </a>
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
              {seedMsg && <div style={alert(seedMsg.type)}>{seedMsg.text}</div>}
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

export default function SettingsPage() {
  return <Suspense><SettingsContent /></Suspense>
}
