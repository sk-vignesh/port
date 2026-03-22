'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/supabase/database.types'

export default function NewPortfolioPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState({ name: '', reference_account_id: '', note: '' })

  useEffect(() => {
    supabase.from('accounts').select('*').eq('is_retired', false).order('name').then(({ data }) => {
      if (data) { setAccounts(data); if (data.length > 0) setForm(f => ({ ...f, reference_account_id: data[0].id })) }
    })
  }, [])

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [f]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data, error } = await supabase.from('portfolios').insert({
      user_id: user.id, name: form.name.trim(),
      reference_account_id: form.reference_account_id || null,
      note: form.note.trim() || null,
    }).select('id').single()
    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/portfolios/${data.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Portfolios</Link> / New
        </div>
        <h1 className="page-title">Create Portfolio</h1>
        <p className="page-subtitle">A securities depot to hold your investment positions</p>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Portfolio Details</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="port-name">Name *</label>
              <input id="port-name" type="text" className="form-input" placeholder="Main Portfolio" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="port-account">Reference Account</label>
              <select id="port-account" className="form-input form-select" value={form.reference_account_id} onChange={set('reference_account_id')}>
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>)}
              </select>
              <div className="text-xs text-muted mt-2">
                The reference account is debited/credited for buy/sell transactions.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="port-note">Notes</label>
              <textarea id="port-note" className="form-input" rows={3} placeholder="Optional…" value={form.note} onChange={set('note')} />
            </div>
          </div>
        </div>
        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button id="save-portfolio-btn" type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Create Portfolio'}</button>
          <Link href="/portfolios" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
