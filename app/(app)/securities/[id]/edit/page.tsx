'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = ['EUR','USD','GBP','INR','CHF','JPY','CAD','AUD','SEK','NOK','DKK']

export default function EditSecurityPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', currency_code: 'EUR', isin: '', ticker_symbol: '', wkn: '', note: '', feed: '', feed_url: '', is_retired: false,
  })

  useEffect(() => {
    supabase.from('securities').select('*').eq('id', params.id).single()
      .then(({ data }) => {
        if (data) setForm({
          name: data.name, currency_code: data.currency_code, isin: data.isin ?? '',
          ticker_symbol: data.ticker_symbol ?? '', wkn: data.wkn ?? '', note: data.note ?? '',
          feed: data.feed ?? '', feed_url: data.feed_url ?? '', is_retired: data.is_retired,
        })
        setLoading(false)
      })
  }, [params.id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('securities').update({
      name: form.name.trim(), currency_code: form.currency_code,
      isin: form.isin.trim() || null, ticker_symbol: form.ticker_symbol.trim() || null,
      wkn: form.wkn.trim() || null, note: form.note.trim() || null,
      feed: form.feed.trim() || null, feed_url: form.feed_url.trim() || null,
      is_retired: form.is_retired,
    }).eq('id', params.id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/securities/${params.id}`)
  }

  if (loading) return <div className="page-header"><h1 className="page-title">Loading…</h1></div>

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/securities" style={{ color: 'var(--color-accent-light)' }}>Securities</Link>
          {' / '}
          <Link href={`/securities/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>{form.name}</Link>
          {' / Edit'}
        </div>
        <h1 className="page-title">Edit Security</h1>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Basic Information</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" value={form.name} onChange={set('name')} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input form-select" value={form.currency_code} onChange={set('currency_code')}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ticker Symbol</label>
                <input type="text" className="form-input font-mono" placeholder="AAPL / RELIANCE.NS" value={form.ticker_symbol} onChange={set('ticker_symbol')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">ISIN</label>
                <input type="text" className="form-input font-mono" value={form.isin} onChange={set('isin')} />
              </div>
              <div className="form-group">
                <label className="form-label">WKN</label>
                <input type="text" className="form-input font-mono" value={form.wkn} onChange={set('wkn')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.note} onChange={set('note')} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={form.is_retired} onChange={e => setForm(v => ({ ...v, is_retired: e.target.checked }))} />
              Mark as retired (hidden from active lists)
            </label>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Price Feed</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Feed Provider</label>
                <input type="text" className="form-input" placeholder="YAHOO" value={form.feed} onChange={set('feed')} />
              </div>
              <div className="form-group">
                <label className="form-label">Feed URL</label>
                <input type="url" className="form-input" value={form.feed_url} onChange={set('feed_url')} />
              </div>
            </div>
            <div className="text-xs text-muted">
              For Indian stocks use ticker like <code>RELIANCE.NS</code> (NSE) or <code>RELIANCE.BO</code> (BSE). Prices are fetched daily via Yahoo Finance.
            </div>
          </div>
        </div>
        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          <Link href={`/securities/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
