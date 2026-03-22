'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = ['EUR','USD','GBP','INR','CHF','JPY','CAD','AUD','SEK','NOK','DKK']

export default function EditAccountPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', currency_code: 'EUR', note: '', is_retired: false })

  useEffect(() => {
    supabase.from('accounts').select('*').eq('id', params.id).single()
      .then(({ data }) => {
        if (data) setForm({ name: data.name, currency_code: data.currency_code, note: data.note ?? '', is_retired: data.is_retired })
        setLoading(false)
      })
  }, [params.id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('accounts').update({
      name: form.name.trim(), currency_code: form.currency_code,
      note: form.note.trim() || null, is_retired: form.is_retired,
    }).eq('id', params.id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/accounts/${params.id}`)
  }

  if (loading) return <div className="page-header"><h1 className="page-title">Loading…</h1></div>

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/accounts" style={{ color: 'var(--color-accent-light)' }}>Accounts</Link>
          {' / '}
          <Link href={`/accounts/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>{form.name}</Link>
          {' / Edit'}
        </div>
        <h1 className="page-title">Edit Account</h1>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Account Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-input form-select" value={form.currency_code} onChange={set('currency_code')}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.note} onChange={set('note')} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={form.is_retired} onChange={e => setForm(v => ({ ...v, is_retired: e.target.checked }))} />
              Mark as retired
            </label>
          </div>
        </div>
        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          <Link href={`/accounts/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
