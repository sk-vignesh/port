'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TX_TYPES = ['DEPOSIT','REMOVAL','INTEREST','INTEREST_CHARGE','DIVIDENDS','FEES','FEES_REFUND','TAXES','TAX_REFUND','BUY','SELL','TRANSFER_IN','TRANSFER_OUT']
const CURRENCIES = ['EUR','USD','GBP','INR','CHF','JPY','CAD','AUD','SEK','NOK','DKK']

export default function NewAccountTransactionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'DEPOSIT', amount: '', currency_code: 'EUR', date: new Date().toISOString().slice(0, 10), note: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || +form.amount <= 0) { setError('Enter a valid amount'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('account_transactions').insert({
      account_id: params.id,
      type: form.type as never,
      amount: Math.round(+form.amount * 100),
      currency_code: form.currency_code,
      date: form.date,
      shares: 0,
      note: form.note || null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/accounts/${params.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/accounts" style={{ color: 'var(--color-accent-light)' }}>Accounts</Link>
          {' / '}
          <Link href={`/accounts/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>Account</Link>
          {' / New Transaction'}
        </div>
        <h1 className="page-title">Add Transaction</h1>
        <p className="page-subtitle">Record a deposit, withdrawal, fee, dividend, or other cash event</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Transaction Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-input form-select" value={form.type} onChange={set('type')}>
                {TX_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" className="form-input" step="0.01" min="0" placeholder="1000.00" value={form.amount} onChange={set('amount')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input form-select" value={form.currency_code} onChange={set('currency_code')}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Transaction'}</button>
          <Link href={`/accounts/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
