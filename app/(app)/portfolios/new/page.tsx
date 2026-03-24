'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/supabase/database.types'

const ASSET_CLASS_OPTIONS = [
  { value: 'EQUITY',       label: 'Equity / Stocks',      icon: '📈', desc: 'Shares, ETFs, mutual funds' },
  { value: 'COMMODITY',    label: 'Commodities',          icon: '🥇', desc: 'Gold, silver, oil, agri' },
  { value: 'FIXED_INCOME', label: 'Fixed Income',         icon: '🏦', desc: 'FDs, bonds, PPF, NSC, debentures' },
  { value: 'REAL_ESTATE',  label: 'Real Estate',          icon: '🏠', desc: 'Property, land, REITs' },
  { value: 'EQUITY',       label: 'Other / Custom',       icon: '📦', desc: 'Any other investment type' },
]

interface Classification { id: string; name: string; taxonomy_name: string }

export default function NewAssetClassPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [accounts, setAccounts]           = useState<Account[]>([])
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [form, setForm] = useState({
    name:                  '',
    asset_class:           'EQUITY',
    reference_account_id:  '',
    classification_id:     '',
    note:                  '',
  })

  useEffect(() => {
    const sb = supabase
    sb.from('accounts').select('*').eq('is_retired', false).order('name').then(({ data }) => {
      if (data) { setAccounts(data); if (data.length > 0) setForm(f => ({ ...f, reference_account_id: data[0].id })) }
    })
    // Load all classifications with their taxonomy names
    sb.from('classifications').select('id, name, taxonomies(name)').then(({ data }) => {
      if (data) {
        setClassifications(data.map((c: { id: string; name: string; taxonomies: unknown }) => ({
          id: c.id, name: c.name,
          taxonomy_name: (c.taxonomies as { name: string } | null)?.name ?? '',
        })))
      }
    })
  }, [])

  const set = (f: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [f]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data, error: err } = await (supabase.from('portfolios') as unknown as { insert: Function }).insert({
      user_id:               user.id,
      name:                  form.name.trim(),
      asset_class:           form.asset_class,
      reference_account_id:  form.reference_account_id || null,
      classification_id:     form.classification_id || null,
      note:                  form.note.trim() || null,
    }).select('id').single()
    if (err) { setError((err as { message: string }).message); setLoading(false); return }
    router.push(`/portfolios/${(data as { id: string }).id}`)
  }

  const selectedAC = ASSET_CLASS_OPTIONS.find(a => a.value === form.asset_class)

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Asset Classes</Link> / New
        </div>
        <h1 className="page-title">New Asset Class</h1>
        <p className="page-subtitle">Create a bucket for a specific type of investment</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 580 }}>
        {/* Asset class type picker */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Investment Type</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ASSET_CLASS_OPTIONS.map(opt => {
                const active = form.asset_class === opt.value && form.name === '' ||
                               form.asset_class === opt.value
                return (
                  <button key={opt.label} type="button"
                    onClick={() => setForm(f => ({ ...f, asset_class: opt.value, name: f.name || opt.label !== 'Other / Custom' ? f.name : '' }))}
                    style={{
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${form.asset_class === opt.value ? 'var(--color-accent-light)' : 'var(--color-border)'}`,
                      background: form.asset_class === opt.value ? 'var(--color-accent-glow)' : 'var(--color-bg-input)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{opt.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: form.asset_class === opt.value ? 'var(--color-accent-light)' : 'var(--color-text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="port-name">Name *</label>
              <input id="port-name" type="text" className="form-input"
                placeholder={selectedAC?.label ?? 'e.g. My Stocks'}
                value={form.name} onChange={set('name')} required />
            </div>

            {/* Segment picker */}
            {classifications.length > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="port-classification">Segment (optional)</label>
                <select id="port-classification" className="form-input form-select"
                  value={form.classification_id} onChange={set('classification_id')}>
                  <option value="">— No segment —</option>
                  {classifications.map(c => (
                    <option key={c.id} value={c.id}>{c.taxonomy_name} › {c.name}</option>
                  ))}
                </select>
                <div className="text-xs text-muted mt-2">
                  Link this asset class to a classification segment for grouping in Analysis views.
                  <Link href="/segments/new" style={{ color: 'var(--color-accent-light)', marginLeft: 6 }}>+ Create segment</Link>
                </div>
              </div>
            )}
            {classifications.length === 0 && (
              <div style={{ padding: '10px 14px', background: 'var(--color-bg-input)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                💡 No segments yet.{' '}
                <Link href="/segments/new" style={{ color: 'var(--color-accent-light)' }}>Create a segment</Link>
                {' '}to organise your asset classes (e.g. Asset Type, Geography).
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="port-account">Reference Account</label>
              <select id="port-account" className="form-input form-select"
                value={form.reference_account_id} onChange={set('reference_account_id')}>
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>)}
              </select>
              <div className="text-xs text-muted mt-2">Debited/credited for buy/sell transactions.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="port-note">Notes</label>
              <textarea id="port-note" className="form-input" rows={2} placeholder="Optional…"
                value={form.note} onChange={set('note')} />
            </div>
          </div>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button id="save-portfolio-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Asset Class'}
          </button>
          <Link href="/portfolios" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
