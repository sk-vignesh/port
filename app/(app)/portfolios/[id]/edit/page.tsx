'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = ['EUR','USD','GBP','INR','CHF','JPY','CAD','AUD','SEK','NOK','DKK']

export default function EditPortfolioPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<{ id: string; name: string; currency_code: string }[]>([])
  const [form, setForm] = useState({ name: '', note: '', reference_account_id: '', is_retired: false })

  useEffect(() => {
    Promise.all([
      supabase.from('portfolios').select('*').eq('id', params.id).single(),
      supabase.from('accounts').select('id, name, currency_code').eq('is_retired', false).order('name'),
    ]).then(([{ data: p }, { data: a }]) => {
      if (p) setForm({ name: p.name, note: p.note ?? '', reference_account_id: p.reference_account_id ?? '', is_retired: p.is_retired })
      if (a) setAccounts(a)
      setLoading(false)
    })
  }, [params.id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('portfolios').update({
      name: form.name.trim(), note: form.note.trim() || null,
      reference_account_id: form.reference_account_id || null, is_retired: form.is_retired,
    }).eq('id', params.id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/portfolios/${params.id}`)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this portfolio? This cannot be undone.')) return
    setDeleting(true)
    const { error: err } = await supabase.from('portfolios').delete().eq('id', params.id)
    if (err) {
      setError(
        err.message.includes('foreign key') || err.code === '23503'
          ? 'This portfolio has transactions. Retire it instead of deleting.'
          : err.message
      )
      setDeleting(false)
      return
    }
    router.push('/portfolios')
  }

  if (loading) return <div className="page-header"><h1 className="page-title">Loading…</h1></div>

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Portfolios</Link>
          {' / '}
          <Link href={`/portfolios/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>{form.name}</Link>
          {' / Edit'}
        </div>
        <h1 className="page-title">Edit Portfolio</h1>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Portfolio Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Reference Account</label>
              <select className="form-input form-select" value={form.reference_account_id} onChange={set('reference_account_id')}>
                <option value="">— none —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>)}
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
          <Link href={`/portfolios/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>

      {/* Danger zone */}
      <div style={{ maxWidth: 520, marginTop: 24, padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(239,68,68,0.3)', background: 'var(--color-danger-bg)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-danger)', marginBottom: 8 }}>Danger Zone</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Deleting a portfolio is permanent. If it has trades recorded, retire it instead.
        </div>
        <button onClick={handleDelete} disabled={deleting} style={{
          padding: '7px 18px', borderRadius: 'var(--radius-md)',
          background: 'var(--color-danger)', color: '#fff',
          border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
          opacity: deleting ? 0.6 : 1,
        }}>
          {deleting ? 'Deleting…' : 'Delete Portfolio'}
        </button>
      </div>
    </>
  )
}
