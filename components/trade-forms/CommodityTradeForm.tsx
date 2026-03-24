'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TX_TYPES = [
  { value: 'BUY',      label: 'Buy',              color: '#22c55e' },
  { value: 'SELL',     label: 'Sell',             color: '#ef4444' },
  { value: 'INTEREST', label: 'Coupon / Interest', color: '#3b82f6' },
  { value: 'MATURITY', label: 'Maturity',          color: '#f59e0b' },
]

const UNIT_TYPES = [
  { value: 'GRAMS',    label: 'Grams (g)'      },
  { value: 'TROY_OZ',  label: 'Troy oz'        },
  { value: 'UNITS',    label: 'Units / Lots'   },
  { value: 'BARRELS',  label: 'Barrels'        },
  { value: 'KG',       label: 'Kilograms (kg)' },
]

const COMMODITY_PRESETS = [
  { name: 'Gold (Physical)', currency: 'INR', defaultUnit: 'GRAMS' },
  { name: 'Gold ETF', currency: 'INR', defaultUnit: 'UNITS' },
  { name: 'Sovereign Gold Bond (SGB)', currency: 'INR', defaultUnit: 'GRAMS' },
  { name: 'Silver', currency: 'INR', defaultUnit: 'GRAMS' },
  { name: 'Crude Oil', currency: 'USD', defaultUnit: 'BARRELS' },
  { name: 'Other / Custom', currency: 'INR', defaultUnit: 'UNITS' },
]

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

interface CommoditySec { id: string; name: string; currency: string }

export default function CommodityTradeForm({ portfolioId }: { portfolioId: string }) {
  const router  = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'pick' | 'trade'>('pick')
  const [selected, setSelected] = useState<CommoditySec | null>(null)
  const [resolving, setResolving] = useState(false)

  const [type, setType]           = useState('BUY')
  const [unitType, setUnitType]   = useState('GRAMS')
  const [quantity, setQuantity]   = useState('')
  const [price, setPrice]         = useState('')
  const [maturity, setMaturity]   = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [customName, setCustomName] = useState('')

  const activeType = TX_TYPES.find(t => t.value === type)!
  const total = quantity && price && +quantity > 0 && +price > 0 ? +quantity * +price : null
  const unitLabel = UNIT_TYPES.find(u => u.value === unitType)?.label ?? unitType

  const handlePickPreset = async (preset: typeof COMMODITY_PRESETS[number], name?: string) => {
    setResolving(true)
    const finalName = name ?? preset.name
    const { data: { user } } = await supabase.auth.getUser()
    const { data: existing } = await supabase.from('securities').select('id, name, currency_code').eq('user_id', user!.id).ilike('name', finalName).maybeSingle()
    if (existing) {
      setSelected({ id: existing.id, name: existing.name, currency: existing.currency_code })
    } else {
      const { data: created } = await supabase.from('securities').insert({ user_id: user!.id, name: finalName, currency_code: preset.currency, feed: 'MANUAL' }).select('id').single()
      if (created) setSelected({ id: created.id, name: finalName, currency: preset.currency })
    }
    setUnitType(preset.defaultUnit)
    setStep('trade'); setResolving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !quantity || +quantity <= 0 || !price || +price <= 0) { setError('Fill in all required fields'); return }
    setLoading(true); setError(null)
    // Store quantity as quantity × 100_000_000 (reuse shares column)
    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id: portfolioId, type: type as never, security_id: selected.id,
      shares: Math.round(+quantity * 100_000_000),
      amount: Math.round(+quantity * +price * 100),
      currency_code: selected.currency, date, note: note || null,
      unit_type: unitType,
      maturity_date: maturity || null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/portfolios/${portfolioId}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step 1: pick commodity */}
      {step === 'pick' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Select Commodity</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolving && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Setting up…</div>}
            {!resolving && COMMODITY_PRESETS.filter(p => p.name !== 'Other / Custom').map(preset => (
              <button key={preset.name} type="button" onClick={() => handlePickPreset(preset)}
                style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 600, textAlign: 'left', fontSize: '0.9rem', transition: 'all 0.15s' }}>
                {preset.name} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.78rem' }}>· {preset.currency} · {UNIT_TYPES.find(u => u.value === preset.defaultUnit)?.label}</span>
              </button>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input type="text" className="form-input" placeholder="Custom commodity name…" value={customName} onChange={e => setCustomName(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={() => handlePickPreset({ name: customName, currency: 'INR', defaultUnit: 'UNITS' }, customName)} disabled={!customName.trim()}
                className="btn btn-secondary">Use</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: trade details */}
      {step === 'trade' && selected && (<>
        <div className="card"><div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selected.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>Commodity · {selected.currency}</div>
          </div>
          <button type="button" onClick={() => { setSelected(null); setStep('pick') }}
            style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>Change ✕</button>
        </div></div>

        {/* Unit type */}
        <div className="card"><div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Unit</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {UNIT_TYPES.map(u => {
              const active = unitType === u.value
              return <button key={u.value} type="button" onClick={() => setUnitType(u.value)}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8rem', border: `1.5px solid ${active ? 'var(--color-accent-light)' : 'var(--color-border)'}`, background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-input)', color: active ? 'var(--color-accent-light)' : 'var(--color-text-muted)', cursor: 'pointer' }}>{u.label}</button>
            })}
          </div>
        </div></div>

        {/* Type */}
        <div className="card"><div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Transaction Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TX_TYPES.map(t => {
              const active = type === t.value
              return <button key={t.value} type="button" onClick={() => setType(t.value)}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem', border: `1.5px solid ${active ? t.color : 'var(--color-border)'}`, background: active ? `${t.color}18` : 'var(--color-bg-input)', color: active ? t.color : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>{t.label}</button>
            })}
          </div>
        </div></div>

        {/* Quantity & Price */}
        <div className="card"><div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Quantity ({unitLabel}) *</label>
              <input type="number" className="form-input" step="0.001" min="0" placeholder="0.000" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Price / {unitLabel} ({selected.currency}) *</label>
              <input type="number" className="form-input" step="0.01" min="0" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
            </div>
          </div>
          {total !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: `${activeType.color}12`, border: `1px solid ${activeType.color}40`, marginTop: 16 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{quantity} {unitLabel} × ₹{price}</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: activeType.color }}>{fmt(total, selected.currency)}</span>
            </div>
          )}
        </div></div>

        {/* Maturity (optional) */}
        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Trade Date *</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Maturity Date (optional)</label>
              <input type="date" className="form-input" value={maturity} onChange={e => setMaturity(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Note</label>
            <textarea className="form-input" rows={2} placeholder="e.g. 24K physical, bank locker storage…" value={note} onChange={e => setNote(e.target.value)} />
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
