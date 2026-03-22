'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput from '@/components/SecuritySearchInput'
import { type IndianStock } from '@/lib/indian-stocks'

export default function NewSecurityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchDone, setSearchDone] = useState(false)

  const [form, setForm] = useState({
    name: '', currency_code: '', isin: '', ticker_symbol: '', wkn: '', note: '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSelect = (stock: IndianStock) => {
    setSearchDone(true)
    setForm(f => ({
      ...f,
      name:          stock.name,
      ticker_symbol: stock.symbol,
      currency_code: 'INR',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.currency_code) { setError('Currency is required — select a security from the search results'); return }
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data, error: err } = await supabase.from('securities').insert({
      user_id: user.id,
      name: form.name.trim(),
      currency_code: form.currency_code,
      isin: form.isin.trim() || null,
      ticker_symbol: form.ticker_symbol.trim() || null,
      wkn: form.wkn.trim() || null,
      note: form.note.trim() || null,
      feed: form.ticker_symbol ? 'YAHOO' : null,
    }).select('id').single()

    if (err) { setError(err.message); setLoading(false); return }
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
        <p className="page-subtitle">Search for a stock, ETF, or fund — or add manually</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        {/* Step 1 — Search */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Search Yahoo Finance</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>auto-fills ticker &amp; currency</span>
          </div>
          <div className="card-body">
            <SecuritySearchInput onSelect={handleSelect} />
            <div className="text-xs text-muted mt-2">
              Supports global markets: US (AAPL), UK (BARC.L), India (RELIANCE.NS), EU, JP and more
            </div>
          </div>
        </div>

        {/* Step 2 — Details (shown after search or for manual entry) */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Details</span>
            {!searchDone && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>auto-filled from search ↑ or enter manually</span>}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" placeholder="Apple Inc." value={form.name} onChange={set('name')} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Ticker Symbol</label>
                <input type="text" className="form-input font-mono" placeholder="AAPL / RELIANCE.NS" value={form.ticker_symbol} onChange={set('ticker_symbol')} />
                <div className="text-xs text-muted mt-1">Used for daily price fetch</div>
              </div>
              <div className="form-group">
                <label className="form-label">Currency *</label>
                <input type="text" className="form-input font-mono" placeholder="EUR / USD / INR"
                  value={form.currency_code}
                  onChange={e => setForm(f => ({ ...f, currency_code: e.target.value.toUpperCase().slice(0, 3) }))}
                  maxLength={3} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">ISIN <span className="text-muted">(optional)</span></label>
                <input type="text" className="form-input font-mono" placeholder="US0378331005" value={form.isin} onChange={set('isin')} />
              </div>
              <div className="form-group">
                <label className="form-label">WKN <span className="text-muted">(optional)</span></label>
                <input type="text" className="form-input font-mono" placeholder="865985" value={form.wkn} onChange={set('wkn')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes <span className="text-muted">(optional)</span></label>
              <textarea className="form-input" rows={2} placeholder="Any additional notes…" value={form.note} onChange={set('note')} />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Add Security'}</button>
          <Link href="/securities" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
