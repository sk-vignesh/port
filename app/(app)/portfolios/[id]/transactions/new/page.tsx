'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput from '@/components/SecuritySearchInput'
import { type IndianStock } from '@/lib/indian-stocks'

const TX_TYPES = [
  { value: 'BUY',               label: 'Buy',          color: '#22c55e' },
  { value: 'SELL',              label: 'Sell',         color: '#ef4444' },
  { value: 'DELIVERY_INBOUND',  label: 'Delivery In',  color: '#3b82f6' },
  { value: 'DELIVERY_OUTBOUND', label: 'Delivery Out', color: '#f59e0b' },
  { value: 'TRANSFER_IN',       label: 'Transfer In',  color: '#8b5cf6' },
  { value: 'TRANSFER_OUT',      label: 'Transfer Out', color: '#64748b' },
]

interface SelectedSecurity { id: string; name: string; ticker: string; currency: string; sector?: string }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)

export default function NewPortfolioTransactionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedSecurity | null>(null)
  const [resolving, setResolving] = useState(false)

  const [type, setType] = useState('BUY')
  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  const totalAmount = shares && price && +shares > 0 && +price > 0
    ? +shares * +price : null

  const activeType = TX_TYPES.find(t => t.value === type)!

  const handleSelectStock = async (stock: IndianStock) => {
    setError(null)
    setResolving(true)
    const { data: existing } = await supabase
      .from('securities').select('id, name, ticker_symbol, currency_code')
      .eq('ticker_symbol', stock.symbol).maybeSingle()
    if (existing) {
      setSelected({ id: existing.id, name: existing.name, ticker: existing.ticker_symbol ?? stock.symbol, currency: existing.currency_code, sector: stock.sector })
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: created, error: cErr } = await supabase.from('securities').insert({
        user_id: user!.id, name: stock.name, ticker_symbol: stock.symbol,
        currency_code: 'INR', feed: 'YAHOO',
      }).select('id').single()
      if (cErr) { setError(`Could not add security: ${cErr.message}`); setResolving(false); return }
      setSelected({ id: created.id, name: stock.name, ticker: stock.symbol, currency: 'INR', sector: stock.sector })
    }
    setResolving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected)             { setError('Select a stock first'); return }
    if (!shares || +shares<=0) { setError('Enter number of shares'); return }
    if (!price  || +price<=0)  { setError('Enter price per share'); return }
    setLoading(true); setError(null)
    const amount = Math.round(+shares * +price * 100)
    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id: params.id, type: type as never, security_id: selected.id,
      shares: Math.round(+shares * 100_000_000), amount,
      currency_code: selected.currency, date, note: note || null,
    })
    if (err) { setError(err.message); setLoading(false); return }

    // Fire-and-forget price fetch — no await, price will be ready when portfolio page loads
    fetch(`/api/prices/refresh?id=${selected.id}`).catch(() => {})

    router.push(`/portfolios/${params.id}`)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="text-sm text-muted mb-2">
          <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Portfolios</Link>
          {' / '}
          <Link href={`/portfolios/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>Portfolio</Link>
          {' / New Trade'}
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>Record Trade</h1>
        <p className="text-muted text-sm">Search for a stock, enter price and quantity</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Stock selector ── */}
        <div className="card">
          <div style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Stock
            </div>
            {!selected ? (
              resolving ? (
                <div style={{ padding: '12px 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Adding security…</div>
              ) : (
                <SecuritySearchInput onSelect={handleSelectStock} />
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: 3 }}>
                    {selected.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
                    <code style={{ color: 'var(--color-accent-light)', background: 'var(--color-accent-glow)', padding: '1px 7px', borderRadius: 4 }}>
                      {selected.ticker}
                    </code>
                    {selected.sector && (
                      <span style={{ color: 'var(--color-text-muted)' }}>{selected.sector}</span>
                    )}
                    <span style={{ color: 'var(--color-text-muted)' }}>· {selected.currency}</span>
                  </div>
                </div>
                <button type="button" onClick={() => { setSelected(null); setShares(''); setPrice('') }}
                  style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  Change ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {selected && (<>

          {/* ── Transaction type ── */}
          <div className="card">
            <div style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Transaction Type
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TX_TYPES.map(t => {
                  const active = type === t.value
                  return (
                    <button key={t.value} type="button" onClick={() => setType(t.value)}
                      style={{
                        padding: '7px 18px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem',
                        border: `1.5px solid ${active ? t.color : 'var(--color-border)'}`,
                        background: active ? `${t.color}18` : 'var(--color-bg-input)',
                        color: active ? t.color : 'var(--color-text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Quantity & Price ── */}
          <div className="card">
            <div style={{ padding: '18px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    Shares / Units *
                  </label>
                  <input type="number" className="form-input" step="0.000001" min="0"
                    placeholder="0" value={shares} onChange={e => setShares(e.target.value)}
                    style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    Price per Share ({selected.currency}) *
                  </label>
                  <input type="number" className="form-input" step="0.01" min="0"
                    placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}
                    style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
                </div>
              </div>

              {/* Total row */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', borderRadius: 'var(--radius-md)',
                background: totalAmount !== null
                  ? `${activeType.color}12`
                  : 'var(--color-bg-input)',
                border: `1px solid ${totalAmount !== null ? `${activeType.color}40` : 'var(--color-border)'}`,
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {totalAmount !== null
                    ? `${fmtNum(+shares)} shares × ₹${fmtNum(+price)}`
                    : 'Total value'}
                </span>
                <span style={{
                  fontSize: '1.3rem', fontWeight: 800,
                  color: totalAmount !== null ? activeType.color : 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {totalAmount !== null ? fmt(totalAmount) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Date & Note ── */}
          <div className="card">
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Trade Date *
                </label>
                <input type="date" className="form-input" value={date}
                  onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea className="form-input" rows={2} placeholder="e.g. Systematic Investment Plan, Dip buy…"
                  value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>
          </div>

        </>)}

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* ── Submit ── */}
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
          <button
            type="submit"
            disabled={loading || !selected}
            style={{
              flex: 1, padding: '14px 24px', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: '1rem', cursor: selected ? 'pointer' : 'not-allowed',
              border: 'none',
              background: selected
                ? `linear-gradient(135deg, ${activeType.color}, ${activeType.color}cc)`
                : 'var(--color-bg-input)',
              color: selected ? '#fff' : 'var(--color-text-muted)',
              boxShadow: selected ? `0 4px 20px ${activeType.color}44` : 'none',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Saving…' : `${activeType.label} ${selected ? selected.name.split(' ')[0] : 'Stock'}`}
          </button>
          <Link href={`/portfolios/${params.id}`}
            style={{
              padding: '14px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-input)',
              color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem',
              display: 'flex', alignItems: 'center',
            }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
