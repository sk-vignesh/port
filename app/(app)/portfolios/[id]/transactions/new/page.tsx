'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput from '@/components/SecuritySearchInput'
import { type IndianStock } from '@/lib/indian-stocks'

const TX_TYPES = [
  { value: 'BUY',               label: 'Buy' },
  { value: 'SELL',              label: 'Sell' },
  { value: 'DELIVERY_INBOUND',  label: 'Delivery In' },
  { value: 'DELIVERY_OUTBOUND', label: 'Delivery Out' },
  { value: 'TRANSFER_IN',       label: 'Transfer In' },
  { value: 'TRANSFER_OUT',      label: 'Transfer Out' },
]

interface SelectedSecurity { id: string; name: string; ticker: string; currency: string }

export default function NewPortfolioTransactionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedSecurity | null>(null)

  const [form, setForm] = useState({
    type: 'BUY',
    shares: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  // Called when user picks a stock from search
  const handleSelectStock = async (stock: IndianStock) => {
    setError(null)
    // Find or auto-create the security in DB
    const { data: existing } = await supabase
      .from('securities').select('id, name, ticker_symbol, currency_code')
      .eq('ticker_symbol', stock.symbol).maybeSingle()

    if (existing) {
      setSelected({ id: existing.id, name: existing.name, ticker: existing.ticker_symbol ?? stock.symbol, currency: existing.currency_code })
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: created, error: cErr } = await supabase.from('securities').insert({
        user_id: user!.id, name: stock.name, ticker_symbol: stock.symbol,
        currency_code: 'INR', feed: 'YAHOO',
      }).select('id').single()
      if (cErr) { setError(`Could not create security: ${cErr.message}`); return }
      setSelected({ id: created.id, name: stock.name, ticker: stock.symbol, currency: 'INR' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError('Search and select a stock first'); return }
    if (!form.shares || +form.shares <= 0) { setError('Enter a valid number of shares'); return }
    if (!form.amount || +form.amount <= 0) { setError('Enter a valid amount'); return }
    setLoading(true); setError(null)

    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id: params.id,
      type: form.type as never,
      security_id: selected.id,
      shares: Math.round(+form.shares * 100_000_000),
      amount: Math.round(+form.amount * 100),
      currency_code: selected.currency,
      date: form.date,
      note: form.note || null,
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/portfolios/${params.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Portfolios</Link>
          {' / '}
          <Link href={`/portfolios/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>Portfolio</Link>
          {' / New Trade'}
        </div>
        <h1 className="page-title">Record Trade</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>

        {/* Step 1 — Search stock */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">
              {selected ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--color-success)' }}>✓</span>
                  {selected.name}
                  <code style={{ fontSize: '0.75rem', color: 'var(--color-accent-light)' }}>{selected.ticker}</code>
                  <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{selected.currency}</span>
                </span>
              ) : 'Search Stock'}
            </span>
            {selected && (
              <button type="button" onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                ✕ change
              </button>
            )}
          </div>
          {!selected && (
            <div className="card-body">
              <SecuritySearchInput onSelect={handleSelectStock} />
            </div>
          )}
        </div>

        {/* Step 2 — Trade details (only shown after stock selected) */}
        {selected && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Trade Details</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Type as pill buttons */}
              <div className="form-group">
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {TX_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: 600,
                        border: form.type === t.value ? '1.5px solid var(--color-accent-light)' : '1.5px solid var(--color-border)',
                        background: form.type === t.value ? 'var(--color-accent-glow)' : 'var(--color-bg-input)',
                        color: form.type === t.value ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Shares *</label>
                  <input type="number" className="form-input" step="0.000001" min="0" placeholder="10" value={form.shares} onChange={set('shares')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Amount * ({selected.currency})</label>
                  <input type="number" className="form-input" step="0.01" min="0" placeholder="15000.00" value={form.amount} onChange={set('amount')} required />
                </div>
              </div>

              {form.shares && form.amount && +form.shares > 0 && +form.amount > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: -8, padding: '6px 10px', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  Price per share: <strong>{(+form.amount / +form.shares).toFixed(2)} {selected.currency}</strong>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={set('date')} required />
              </div>

              <div className="form-group">
                <label className="form-label">Note <span className="text-muted">(optional)</span></label>
                <textarea className="form-input" rows={2} placeholder="Optional…" value={form.note} onChange={set('note')} />
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}

        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading || !selected}>
            {loading ? 'Saving…' : 'Save Trade'}
          </button>
          <Link href={`/portfolios/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
