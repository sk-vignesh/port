'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'



const PROPERTY_TYPES = [
  'Residential Apartment', 'Independent House / Villa', 'Plot / Land',
  'Commercial Office', 'Commercial Shop / Retail', 'Warehouse / Industrial', 'Other',
]

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

const RE_TYPES = [
  { value: 'BUY',              label: 'Purchase',         color: '#22c55e' },
  { value: 'SELL',             label: 'Sale',             color: '#ef4444' },
  { value: 'INTEREST',         label: 'Rental Income',    color: '#3b82f6' },
  { value: 'DELIVERY_INBOUND', label: 'Capital Expense',  color: '#f59e0b' },
  { value: 'TRANSFER_IN',      label: 'Mortgage Payment', color: '#8b5cf6' },
]

interface RESec { id: string; name: string; currency: string }

export default function RealEstateTradeForm({ portfolioId }: { portfolioId: string }) {
  const router   = useRouter()
  const supabase = createClient()

  const [step, setStep]         = useState<'pick' | 'trade'>('pick')
  const [selected, setSelected] = useState<RESec | null>(null)
  const [resolving, setResolving] = useState(false)

  const [propertyName, setPropertyName] = useState('')
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0])
  const [type, setType]         = useState('BUY')
  const [amount, setAmount]     = useState('')       // total transaction amount
  const [stampDuty, setStampDuty] = useState('')    // fees — stamp duty
  const [area, setArea]         = useState('')       // sqft
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const activeType = RE_TYPES.find(t => t.value === type) ?? RE_TYPES[0]
  const isPurchase = type === 'BUY'

  const handleCreateProperty = async () => {
    if (!propertyName.trim()) { setError('Enter property name'); return }
    setResolving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const secName = `${propertyName} (${propertyType})`
    const { data: existing } = await supabase.from('securities').select('id, name, currency_code').eq('user_id', user!.id).eq('name', secName).maybeSingle()
    if (existing) {
      setSelected({ id: existing.id, name: existing.name, currency: existing.currency_code })
    } else {
      const { data: created } = await supabase.from('securities').insert({ user_id: user!.id, name: secName, currency_code: 'INR', feed: 'MANUAL', note: propertyType }).select('id').single()
      if (created) setSelected({ id: created.id, name: secName, currency: 'INR' })
    }
    setStep('trade'); setResolving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !amount || +amount <= 0) { setError('Enter transaction amount'); return }
    setLoading(true); setError(null)

    const txAmount = Math.round(+amount * 100)
    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id: portfolioId,
      type:         type as never,
      security_id:  selected.id,
      shares:       100_000_000, // "1 unit" = the property
      amount:       txAmount,
      currency_code: 'INR',
      date, note: note || null,
      unit_type:    'SQFT',
      area:         area ? parseInt(area) : null,
    })
    if (err) { setError(err.message); setLoading(false); return }

    // Record stamp duty as a fee unit if present
    if (stampDuty && +stampDuty > 0) {
      const { data: txRow } = await supabase.from('portfolio_transactions').select('id').eq('portfolio_id', portfolioId).order('created_at', { ascending: false }).limit(1).single()
      if (txRow) {
        await supabase.from('portfolio_transaction_units').insert({
          transaction_id: txRow.id, type: 'FEE',
          amount: Math.round(+stampDuty * 100), currency_code: 'INR',
        })
      }
    }

    router.push(`/portfolios/${portfolioId}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step 1: property picker */}
      {step === 'pick' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Property Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div style={{ padding: '8px 12px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</div>}
            <div>
              <label className="form-label">Property Name *</label>
              <input type="text" className="form-input" placeholder="e.g. Flat 402, Green Valley Apartments" value={propertyName} onChange={e => setPropertyName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Property Type</label>
              <select className="form-input form-select" value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="button" onClick={handleCreateProperty} disabled={!propertyName.trim() || resolving} className="btn btn-primary">
              {resolving ? 'Setting up…' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: transaction */}
      {step === 'trade' && selected && (<>
        <div className="card"><div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selected.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>Real Estate · INR</div>
          </div>
          <button type="button" onClick={() => { setSelected(null); setStep('pick') }}
            style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>Change ✕</button>
        </div></div>

        {/* Type */}
        <div className="card"><div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Transaction Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {RE_TYPES.map(t => {
              const active = type === t.value && activeType.label === t.label
              return <button key={t.label} type="button" onClick={() => setType(t.value)}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem', border: `1.5px solid ${active ? t.color : 'var(--color-border)'}`, background: active ? `${t.color}18` : 'var(--color-bg-input)', color: active ? t.color : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>{t.label}</button>
            })}
          </div>
        </div></div>

        {/* Amounts */}
        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isPurchase ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                {type === 'INTEREST' ? 'Rental Amount (INR) *' : isPurchase ? 'Purchase Price (INR) *' : 'Sale Price (INR) *'}
              </label>
              <input type="number" className="form-input" step="1" min="0" placeholder="5000000" value={amount} onChange={e => setAmount(e.target.value)} style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'right' }} required />
              {amount && +amount > 0 && <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>{fmt(+amount)}</div>}
            </div>
            {isPurchase && (
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Stamp Duty + Registration (INR)</label>
                <input type="number" className="form-input" step="1" min="0" placeholder="0" value={stampDuty} onChange={e => setStampDuty(e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} />
              </div>
            )}
          </div>
          {isPurchase && (
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Built-up Area (sq ft)</label>
              <input type="number" className="form-input" step="1" min="0" placeholder="1200" value={area} onChange={e => setArea(e.target.value)} style={{ textAlign: 'right' }} />
              {area && amount && +area > 0 && +amount > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>₹{Math.round(+amount / +area).toLocaleString('en-IN')} / sq ft</div>
              )}
            </div>
          )}
        </div></div>

        {/* Date & Note */}
        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Transaction Date *</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Note</label>
            <textarea className="form-input" rows={2} placeholder="e.g. SBI home loan, RERA ID, tenant details…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div></div>
      </>)}

      {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</div>}

      {step === 'trade' && (
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
          <button type="submit" disabled={loading}
            style={{ flex: 1, padding: '14px 24px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${activeType.color}, ${activeType.color}cc)`, color: '#fff', boxShadow: `0 4px 20px ${activeType.color}44`, transition: 'all 0.2s' }}>
            {loading ? 'Saving…' : `Record ${activeType.label}`}
          </button>
          <Link href={`/portfolios/${portfolioId}`} style={{ padding: '14px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>Cancel</Link>
        </div>
      )}
    </form>
  )
}
