'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK']

export default function NewSecurityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    currency_code: 'EUR',
    isin: '',
    ticker_symbol: '',
    wkn: '',
    note: '',
    feed: '',
    feed_url: '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      currency_code: form.currency_code,
      isin: form.isin.trim() || null,
      ticker_symbol: form.ticker_symbol.trim() || null,
      wkn: form.wkn.trim() || null,
      note: form.note.trim() || null,
      feed: form.feed.trim() || null,
      feed_url: form.feed_url.trim() || null,
    }

    const { data, error } = await supabase.from('securities').insert(payload).select('id').single()
    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/securities/${data.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/securities" style={{ color: 'var(--color-accent-light)' }}>Securities</Link>
          {' / '}New
        </div>
        <h1 className="page-title">Add Security</h1>
        <p className="page-subtitle">Stocks, ETFs, cryptocurrency, bonds, or other assets</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Basic Information</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="sec-name">Name *</label>
              <input id="sec-name" type="text" className="form-input" placeholder="Apple Inc." value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="sec-currency">Currency *</label>
                <select id="sec-currency" className="form-input form-select" value={form.currency_code} onChange={set('currency_code')}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sec-ticker">Ticker Symbol</label>
                <input id="sec-ticker" type="text" className="form-input font-mono" placeholder="AAPL" value={form.ticker_symbol} onChange={set('ticker_symbol')} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="sec-isin">ISIN</label>
                <input id="sec-isin" type="text" className="form-input font-mono" placeholder="US0378331005" value={form.isin} onChange={set('isin')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sec-wkn">WKN</label>
                <input id="sec-wkn" type="text" className="form-input font-mono" placeholder="865985" value={form.wkn} onChange={set('wkn')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sec-note">Notes</label>
              <textarea id="sec-note" className="form-input" placeholder="Optional description…" rows={3} value={form.note} onChange={set('note')} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Price Feed (Optional)</span></div>
          <div className="card-body">
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="sec-feed">Feed Provider</label>
                <input id="sec-feed" type="text" className="form-input" placeholder="e.g. YAHOO" value={form.feed} onChange={set('feed')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sec-feed-url">Feed URL</label>
                <input id="sec-feed-url" type="url" className="form-input" placeholder="https://…" value={form.feed_url} onChange={set('feed_url')} />
              </div>
            </div>
            <div className="text-xs text-muted">
              Price feeds are for reference — historical prices can be imported or entered manually.
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--color-danger-bg)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div className="flex flex-gap-3">
          <button id="save-security-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Add Security'}
          </button>
          <Link href="/securities" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
