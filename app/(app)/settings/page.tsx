'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK']

export default function SettingsPage() {
  const [baseCurrency, setBaseCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      const { data } = await supabase.from('user_settings').select('base_currency').eq('user_id', user!.id).single()
      if (data) setBaseCurrency(data.base_currency)
    })()
  }, [])

  const saveCurrency = async () => {
    setSaving(true)
    setMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_settings').upsert({ user_id: user!.id, base_currency: baseCurrency })
    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Settings saved!' })
    setSaving(false)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Account and display preferences</p>
      </div>

      <div className="grid-2" style={{ maxWidth: 800 }}>
        {/* Account */}
        <div className="card">
          <div className="card-header"><span className="card-title">Account</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="text" className="form-input" value={email ?? '…'} disabled style={{ opacity: 0.6 }} />
            </div>
            <div className="text-sm text-muted">To change your password, sign out and use the reset password flow.</div>
          </div>
        </div>

        {/* Display */}
        <div className="card">
          <div className="card-header"><span className="card-title">Display</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="base-currency">Base Currency</label>
              <select
                id="base-currency"
                className="form-input form-select"
                value={baseCurrency}
                onChange={e => setBaseCurrency(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="text-xs text-muted mt-2">
                Used for aggregated portfolio value calculations and cross-currency conversion.
              </div>
            </div>

            {msg && (
              <div style={{
                padding: '10px 14px',
                background: msg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 'var(--radius-md)',
                color: msg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: '0.875rem',
                marginBottom: 16,
              }}>
                {msg.text}
              </div>
            )}

            <button
              id="save-settings-btn"
              className="btn btn-primary"
              onClick={saveCurrency}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="card mt-4" style={{ maxWidth: 800 }}>
        <div className="card-header"><span className="card-title">About</span></div>
        <div className="card-body">
          <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Portfolio Performance Web</strong>
            {' '}— a web adaptation of the open-source{' '}
            <a href="https://www.portfolio-performance.info" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--color-accent-light)' }}>
              Portfolio Performance
            </a>{' '}
            desktop application. Track stocks, ETFs, cryptocurrencies and other assets with full transaction history,
            performance metrics, and taxonomy-based allocation analysis.
          </p>
          <div className="flex flex-gap-3 mt-4">
            <span className="badge badge-gray">Next.js 14</span>
            <span className="badge badge-gray">Supabase</span>
            <span className="badge badge-gray">TypeScript</span>
            <span className="badge badge-gray">EPL Licensed</span>
          </div>
        </div>
      </div>
    </>
  )
}
