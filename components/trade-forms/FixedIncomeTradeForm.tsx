'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TX_TYPES = [
  { value: 'BUY',               label: 'Purchase',             color: '#22c55e' },
  { value: 'SELL',              label: 'Maturity / Redemption', color: '#f59e0b' },
  { value: 'INTEREST',          label: 'Interest Received',    color: '#3b82f6' },
  { value: 'DELIVERY_OUTBOUND', label: 'Premature Withdrawal', color: '#ef4444' },
  { value: 'TRANSFER_IN',       label: 'Reinvest Interest',    color: '#8b5cf6' },
]

const FREQUENCIES = [
  { value: 'MONTHLY',     label: 'Monthly'     },
  { value: 'QUARTERLY',   label: 'Quarterly'   },
  { value: 'SEMI_ANNUAL', label: 'Half-Yearly' },
  { value: 'ANNUAL',      label: 'Annual'      },
  { value: 'AT_MATURITY', label: 'At Maturity' },
]

const INSTRUMENTS = [
  { name: 'Fixed Deposit (FD)',                     currency: 'INR' },
  { name: 'Public Provident Fund (PPF)',             currency: 'INR' },
  { name: 'National Savings Certificate (NSC)',      currency: 'INR' },
  { name: 'Corporate Bond / NCD',                   currency: 'INR' },
  { name: 'G-Sec / T-Bill',                         currency: 'INR' },
  { name: 'Employee Provident Fund (EPF)',           currency: 'INR' },
  { name: 'Sukanya Samriddhi Yojana (SSY)',          currency: 'INR' },
]

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

interface FISec { id: string; name: string; currency: string }

export default function FixedIncomeTradeForm({ portfolioId }: { portfolioId: string }) {
  const router   = useRouter()
  const supabase = createClient()

  const [step, setStep]           = useState<'pick' | 'trade'>('pick')
  const [selected, setSelected]   = useState<FISec | null>(null)
  const [resolving, setResolving] = useState(false)
  const [customName, setCustomName] = useState('')
  const [issuer, setIssuer]       = useState('')

  const [type, setType]           = useState('BUY')
  const [principal, setPrincipal] = useState('')
  const [coupon, setCoupon]       = useState('')
  const [frequency, setFrequency] = useState('ANNUAL')
  const [maturity, setMaturity]   = useState('')
  const [interestAmt, setInterestAmt] = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const activeType = TX_TYPES.find(t => t.value === type)!
  const isInterest = type === 'INTEREST' || type === 'TRANSFER_IN'

  const periodicInterest = (() => {
    if (!principal || !coupon || +principal <= 0 || +coupon <= 0) return null
    const annual = +principal * (+coupon / 100)
    const div: Record<string, number> = { MONTHLY: 12, QUARTERLY: 4, SEMI_ANNUAL: 2, ANNUAL: 1, AT_MATURITY: 1 }
    return annual / (div[frequency] ?? 1)
  })()

  const resolveInstrument = async (name: string, currency: string) => {
    setResolving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const secName = issuer ? `${name} — ${issuer}` : name
    const { data: ex } = await supabase.from('securities').select('id, name, currency_code').eq('user_id', user!.id).ilike('name', `%${name}%`).limit(1).maybeSingle()
    if (ex) {
      setSelected({ id: ex.id, name: ex.name, currency: ex.currency_code })
    } else {
      const { data: cr } = await supabase.from('securities').insert({ user_id: user!.id, name: secName, currency_code: currency, feed: 'MANUAL' }).select('id').single()
      if (cr) setSelected({ id: cr.id, name: secName, currency })
    }
    setStep('trade'); setResolving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError('Select an instrument'); return }
    if (isInterest && (!interestAmt || +interestAmt <= 0)) { setError('Enter interest amount received'); return }
    if (!isInterest && (!principal || +principal <= 0)) { setError('Enter principal amount'); return }
    setLoading(true); setError(null)

    const amount = isInterest ? Math.round(+interestAmt * 100) : Math.round(+principal * 100)
    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id:        portfolioId,
      type:                type as never,
      security_id:         selected.id,
      shares:              100_000_000,
      amount,
      currency_code:       selected.currency,
      date,
      note:                note || null,
      unit_type:           'UNITS',
      face_value:          principal ? Math.round(+principal * 100) : null,
      coupon_rate:         coupon ? +coupon : null,
      maturity_date:       maturity || null,
      interest_frequency:  frequency,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/portfolios/${portfolioId}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {step === 'pick' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Select Instrument</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Issuer / Bank (optional)</label>
              <input type="text" className="form-input" placeholder="e.g. SBI, HDFC, RBI…" value={issuer} onChange={e => setIssuer(e.target.value)} />
            </div>
            {resolving && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Setting up…</div>}
            {!resolving && INSTRUMENTS.map(inst => (
              <button key={inst.name} type="button" onClick={() => resolveInstrument(inst.name, inst.currency)}
                style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 600, textAlign: 'left', fontSize: '0.9rem' }}>
                {inst.name}
              </button>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input type="text" className="form-input" placeholder="Custom instrument name…" value={customName} onChange={e => setCustomName(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={() => resolveInstrument(customName, 'INR')} disabled={!customName.trim()} className="btn btn-secondary">Use</button>
            </div>
          </div>
        </div>
      )}

      {step === 'trade' && selected && (<>
        <div className="card"><div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selected.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>Fixed Income · {selected.currency}</div>
          </div>
          <button type="button" onClick={() => { setSelected(null); setStep('pick') }}
            style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>Change ✕</button>
        </div></div>

        <div className="card"><div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Transaction Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TX_TYPES.map(t => { const active = type === t.value; return (
              <button key={t.value} type="button" onClick={() => setType(t.value)}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem', border: `1.5px solid ${active ? t.color : 'var(--color-border)'}`, background: active ? `${t.color}18` : 'var(--color-bg-input)', color: active ? t.color : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>{t.label}</button>
            )})}
          </div>
        </div></div>

        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isInterest ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Interest Received ({selected.currency}) *</label>
              <input type="number" className="form-input" step="0.01" min="0" placeholder="0.00" value={interestAmt} onChange={e => setInterestAmt(e.target.value)} style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'right' }} required />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Principal ({selected.currency}) *</label>
                <input type="number" className="form-input" step="0.01" min="0" placeholder="100000" value={principal} onChange={e => setPrincipal(e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Coupon Rate (% p.a.)</label>
                <input type="number" className="form-input" step="0.01" min="0" max="100" placeholder="7.50" value={coupon} onChange={e => setCoupon(e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} />
              </div>
            </div>
          )}

          {!isInterest && (<>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Interest Frequency</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FREQUENCIES.map(f => { const a = frequency === f.value; return (
                  <button key={f.value} type="button" onClick={() => setFrequency(f.value)}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8rem', border: `1.5px solid ${a ? 'var(--color-accent-light)' : 'var(--color-border)'}`, background: a ? 'var(--color-accent-glow)' : 'var(--color-bg-input)', color: a ? 'var(--color-accent-light)' : 'var(--color-text-muted)', cursor: 'pointer' }}>{f.label}</button>
                )})}
              </div>
            </div>
            {periodicInterest !== null && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Expected periodic payout: </span>
                <strong style={{ color: '#3b82f6' }}>{fmt(periodicInterest, selected.currency)}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}> · Annual: </span>
                <strong>{fmt(+principal * (+coupon / 100), selected.currency)}</strong>
              </div>
            )}
          </>)}
        </div></div>

        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>{isInterest ? 'Date Received *' : 'Purchase Date *'}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            {!isInterest && (
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Maturity Date</label>
                <input type="date" className="form-input" value={maturity} onChange={e => setMaturity(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Note</label>
            <textarea className="form-input" rows={2} placeholder="e.g. SBI FD, 7.5% p.a., auto-renew quarterly…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div></div>
      </>)}

      {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</div>}

      {step === 'trade' && (
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
          <button type="submit" disabled={loading}
            style={{ flex: 1, padding: '14px 24px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${activeType.color}, ${activeType.color}cc)`, color: '#fff', transition: 'all 0.2s' }}>
            {loading ? 'Saving…' : `Record ${activeType.label}`}
          </button>
          <Link href={`/portfolios/${portfolioId}`} style={{ padding: '14px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>Cancel</Link>
        </div>
      )}
    </form>
  )
}
