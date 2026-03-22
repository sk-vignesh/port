'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK']

export default function NewAccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', currency_code: 'EUR', note: '' })

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [f]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data, error } = await supabase.from('accounts').insert({
      user_id: user.id, name: form.name.trim(),
      currency_code: form.currency_code, note: form.note.trim() || null,
    }).select('id').single()
    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/accounts/${data.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/accounts" style={{ color: 'var(--color-accent-light)' }}>Accounts</Link> / New
        </div>
        <h1 className="page-title">Add Account</h1>
        <p className="page-subtitle">Cash or brokerage account to record transactions</p>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Account Details</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="acc-name">Account Name *</label>
              <input id="acc-name" type="text" className="form-input" placeholder="Main Brokerage" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="acc-currency">Currency *</label>
              <select id="acc-currency" className="form-input form-select" value={form.currency_code} onChange={set('currency_code')}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="acc-note">Notes</label>
              <textarea id="acc-note" className="form-input" rows={3} placeholder="Optional…" value={form.note} onChange={set('note')} />
            </div>
          </div>
        </div>
        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button id="save-account-btn" type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Add Account'}</button>
          <Link href="/accounts" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
