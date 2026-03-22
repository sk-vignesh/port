'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TX_TYPES = ['BUY', 'SELL', 'DELIVERY_INBOUND', 'DELIVERY_OUTBOUND', 'TRANSFER_IN', 'TRANSFER_OUT']

export default function NewPortfolioTransactionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [securities, setSecurities] = useState<{ id: string; name: string; currency_code: string }[]>([])
  const [form, setForm] = useState({
    type: 'BUY', security_id: '', shares: '', amount: '', currency_code: 'EUR', date: new Date().toISOString().slice(0, 10), note: '',
  })

  useEffect(() => {
    supabase.from('securities').select('id, name, currency_code').eq('is_retired', false).order('name')
      .then(({ data }) => { if (data) { setSecurities(data); if (data[0]) setForm(f => ({ ...f, security_id: data[0].id, currency_code: data[0].currency_code })) } })
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.security_id) { setError('Select a security'); return }
    if (!form.shares || +form.shares <= 0) { setError('Enter valid share count'); return }
    if (!form.amount || +form.amount <= 0) { setError('Enter valid amount'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id: params.id,
      type: form.type as never,
      security_id: form.security_id,
      shares: Math.round(+form.shares * 100_000_000),
      amount: Math.round(+form.amount * 100),
      currency_code: form.currency_code,
      date: form.date,
      note: form.note || null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/portfolios/${params.id}`)
  }

  const selectedSec = securities.find(s => s.id === form.security_id)

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
        <p className="page-subtitle">Buy, sell, or transfer securities in this portfolio</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 580 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Transaction Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-input form-select" value={form.type} onChange={set('type')}>
                {TX_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Security *</label>
              <select className="form-input form-select" value={form.security_id} onChange={e => {
                const sec = securities.find(s => s.id === e.target.value)
                setForm(f => ({ ...f, security_id: e.target.value, currency_code: sec?.currency_code ?? f.currency_code }))
              }}>
                <option value="">— select security —</option>
                {securities.map(s => <option key={s.id} value={s.id}>{s.name} ({s.currency_code})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Shares *</label>
                <input type="number" className="form-input" step="0.000001" min="0" placeholder="10" value={form.shares} onChange={set('shares')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount * ({selectedSec?.currency_code ?? form.currency_code})</label>
                <input type="number" className="form-input" step="0.01" min="0" placeholder="1500.00" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={set('date')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-input" rows={2} placeholder="Optional…" value={form.note} onChange={set('note')} />
            </div>
          </div>
        </div>
        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Trade'}</button>
          <Link href={`/portfolios/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
