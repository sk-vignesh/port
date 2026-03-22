'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const EVENT_TYPES = [
  { value: 'DIVIDEND',   label: '💰 Dividend',    fields: ['amount', 'currency'] },
  { value: 'SPLIT',      label: '✂️ Stock Split',  fields: ['ratio'] },
  { value: 'SPIN_OFF',   label: '🔀 Spin-Off',     fields: ['description'] },
  { value: 'RIGHTS',     label: '📋 Rights Issue', fields: ['ratio', 'price'] },
  { value: 'BONUS',      label: '🎁 Bonus Issue',  fields: ['ratio'] },
  { value: 'NOTE',       label: '📝 Note',         fields: [] },
]

export default function NewSecurityEventPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('DIVIDEND')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  // Dynamic detail fields
  const [amount,      setAmount]      = useState('')
  const [currency,    setCurrency]    = useState('INR')
  const [ratio,       setRatio]       = useState('')   // e.g. "2:1"
  const [price,       setPrice]       = useState('')
  const [description, setDescription] = useState('')

  const selectedType = EVENT_TYPES.find(t => t.value === type)!

  const buildDetails = () => {
    const d: Record<string, unknown> = {}
    if (selectedType.fields.includes('amount')  && amount)      d.amount = +amount
    if (selectedType.fields.includes('currency'))               d.currency = currency
    if (selectedType.fields.includes('ratio')   && ratio)       d.ratio = ratio
    if (selectedType.fields.includes('price')   && price)       d.price = +price
    if (selectedType.fields.includes('description') && description) d.description = description
    return d
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('security_events').insert({
      security_id: params.id,
      type,
      date,
      details: buildDetails(),
      note: note.trim() || null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/securities/${params.id}`)
  }

  const formatRatioHint = () => {
    if (type === 'SPLIT')  return 'e.g. 2:1 (2 new shares per 1 old)'
    if (type === 'RIGHTS') return 'e.g. 1:4 (1 right per 4 shares)'
    if (type === 'BONUS')  return 'e.g. 1:1 (1 bonus per 1 share)'
    return ''
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/securities" style={{ color: 'var(--color-accent-light)' }}>Securities</Link>
          {' / '}
          <Link href={`/securities/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>Security</Link>
          {' / New Event'}
        </div>
        <h1 className="page-title">Record Event</h1>
        <p className="page-subtitle">Dividends, splits, bonus issues, rights issues and other corporate actions</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 540 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Event Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Type selector as button group */}
            <div className="form-group">
              <label className="form-label">Event Type *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => setType(t.value)}
                    style={{
                      padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: 600,
                      border: type === t.value ? '1.5px solid var(--color-accent-light)' : '1.5px solid var(--color-border)',
                      background: type === t.value ? 'var(--color-accent-glow)' : 'var(--color-bg-input)',
                      color: type === t.value ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Ex-Date *</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            {/* Dynamic fields */}
            {type === 'DIVIDEND' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Amount per Share *</label>
                  <input type="number" className="form-input" step="0.01" min="0" placeholder="25.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <input type="text" className="form-input font-mono" maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase().slice(0,3))} />
                </div>
              </div>
            )}

            {(type === 'SPLIT' || type === 'RIGHTS' || type === 'BONUS') && (
              <div className="form-group">
                <label className="form-label">Ratio *</label>
                <input type="text" className="form-input font-mono" placeholder={formatRatioHint()} value={ratio} onChange={e => setRatio(e.target.value)} required />
                <div className="text-xs text-muted mt-1">{formatRatioHint()}</div>
              </div>
            )}

            {type === 'RIGHTS' && (
              <div className="form-group">
                <label className="form-label">Issue Price (per share)</label>
                <input type="number" className="form-input" step="0.01" min="0" placeholder="100.00" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            )}

            {type === 'SPIN_OFF' && (
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="form-input" placeholder="e.g. Jio Financial Services demerged at 1:1" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            )}

            {/* Note */}
            <div className="form-group">
              <label className="form-label">Note <span className="text-muted">(optional)</span></label>
              <textarea className="form-input" rows={2} placeholder="Additional context…" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Event'}</button>
          <Link href={`/securities/${params.id}`} className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
