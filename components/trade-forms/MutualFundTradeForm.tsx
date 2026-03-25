'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

const TX_TYPES = [
  { value: 'BUY',      label: 'SIP / Lump Sum Purchase', color: '#22c55e' },
  { value: 'SELL',     label: 'Redemption',              color: '#ef4444' },
  { value: 'DIVIDEND', label: 'Dividend Reinvestment',   color: '#3b82f6' },
]

interface AmfiScheme {
  code: string
  name: string
}

interface SelectedScheme {
  id: string       // Supabase security ID
  name: string
  amfiCode: string
  currency: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 4 }).format(n)

export default function MutualFundTradeForm({ portfolioId }: { portfolioId: string }) {
  const router   = useRouter()
  const supabase = createClient()

  const [step,        setStep]        = useState<'search' | 'trade'>('search')
  const [selected,    setSelected]    = useState<SelectedScheme | null>(null)
  const [query,       setQuery]       = useState('')
  const [schemes,     setSchemes]     = useState<AmfiScheme[]>([])
  const [searching,   setSearching]   = useState(false)
  const [resolving,   setResolving]   = useState(false)

  const [txType,      setTxType]      = useState('BUY')
  const [units,       setUnits]       = useState('')
  const [nav,         setNav]         = useState('')
  const [folioNum,    setFolioNum]    = useState('')
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [note,        setNote]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const activeType = TX_TYPES.find(t => t.value === txType)!
  const total      = units && nav && +units > 0 && +nav > 0 ? +units * +nav : null

  // Debounced AMFI search
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setSchemes([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/amfi-nav?q=${encodeURIComponent(q)}`,
          { headers: { apikey: ANON_KEY } }
        )
        if (res.ok) {
          const data: AmfiScheme[] = await res.json()
          setSchemes(Array.isArray(data) ? data : [])
        }
      } catch { /* silent */ }
      setSearching(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  // Auto-fetch latest NAV when date changes and scheme is selected
  useEffect(() => {
    if (!selected?.amfiCode) return
    fetch(
      `${SUPABASE_URL}/functions/v1/amfi-nav?code=${encodeURIComponent(selected.amfiCode)}`,
      { headers: { apikey: ANON_KEY } }
    )
      .then(r => r.json())
      .then((data: { nav?: number }) => {
        if (data?.nav) setNav(String(data.nav))
      })
      .catch(() => { /* keep field empty — user can enter manually */ })
  }, [selected, date])

  const handlePickScheme = async (scheme: AmfiScheme) => {
    setResolving(true)
    const { data: { user } } = await supabase.auth.getUser()
    // Find or create security record
    const { data: existing } = await supabase
      .from('securities')
      .select('id, name')
      .eq('user_id', user!.id)
      .eq('amfi_scheme_code', scheme.code)
      .maybeSingle()

    let secId: string
    let secName: string
    if (existing) {
      secId   = existing.id
      secName = existing.name
    } else {
      const { data: created } = await supabase
        .from('securities')
        .insert({
          user_id:          user!.id,
          name:             scheme.name,
          ticker_symbol:    `MF:${scheme.code}`,  // synthetic ticker to avoid clashes
          currency_code:    'INR',
          feed:             'AMFI',
          amfi_scheme_code: scheme.code,
        })
        .select('id')
        .single()
      secId   = created?.id ?? ''
      secName = scheme.name
    }

    setSelected({ id: secId, name: secName, amfiCode: scheme.code, currency: 'INR' })
    setQuery('')
    setSchemes([])
    setStep('trade')
    setResolving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !units || +units <= 0 || !nav || +nav <= 0) {
      setError('Fill in all required fields'); return
    }
    setLoading(true); setError(null)

    const { error: err } = await supabase.from('portfolio_transactions').insert({
      portfolio_id:  portfolioId,
      security_id:   selected.id,
      type:          txType as never,
      shares:        Math.round(+units * 100_000_000),   // units × scale
      amount:        Math.round(+units * +nav * 100),     // total invested × scale
      currency_code: 'INR',
      date,
      unit_type:     'UNITS',
      folio_number:  folioNum || null,
      note:          note || null,
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/portfolios/${portfolioId}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Step 1: Scheme Search ───────────────────────────────────────── */}
      {step === 'search' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Search Mutual Fund</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-muted)' }}>🔍</span>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 36 }}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search: HDFC Mid Cap, Nippon India, SBI Bluechip…"
                autoFocus
                autoComplete="off"
              />
            </div>

            {searching && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Searching AMFI…</div>}
            {resolving && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Setting up fund record…</div>}

            {!searching && !resolving && schemes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {schemes.map(s => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => handlePickScheme(s)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)',
                      cursor: 'pointer', fontWeight: 500, textAlign: 'left', fontSize: '0.85rem',
                      transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span>{s.name}</span>
                    <code style={{ fontSize: '0.68rem', color: 'var(--color-accent-light)', marginLeft: 8, flexShrink: 0 }}>{s.code}</code>
                  </button>
                ))}
              </div>
            )}

            {!searching && !resolving && query.length >= 2 && schemes.length === 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                No funds found. Try a different search term.
              </div>
            )}

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Powered by AMFI India open data — covers all registered mutual funds.
            </p>
          </div>
        </div>
      )}

      {/* ── Step 2: Trade Details ─────────────────────────────────────── */}
      {step === 'trade' && selected && (<>

        {/* Selected fund header */}
        <div className="card">
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Mutual Fund · AMFI {selected.amfiCode} · INR
              </div>
            </div>
            <button type="button" onClick={() => { setSelected(null); setStep('search'); setNav('') }}
              style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
              Change ✕
            </button>
          </div>
        </div>

        {/* Transaction type */}
        <div className="card"><div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Transaction Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TX_TYPES.map(t => {
              const active = txType === t.value
              return (
                <button key={t.value} type="button" onClick={() => setTxType(t.value)}
                  style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem', border: `1.5px solid ${active ? t.color : 'var(--color-border)'}`, background: active ? `${t.color}18` : 'var(--color-bg-input)', color: active ? t.color : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              )
            })}
          </div>
        </div></div>

        {/* Units, NAV, Folio */}
        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Units *</label>
              <input type="number" className="form-input" step="0.001" min="0.001" placeholder="0.000"
                value={units} onChange={e => setUnits(e.target.value)}
                style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                NAV / Unit (₹) *
                {nav && <span style={{ color: 'var(--color-accent-light)', fontWeight: 400 }}> · auto-fetched</span>}
              </label>
              <input type="number" className="form-input" step="0.0001" min="0.0001" placeholder="0.0000"
                value={nav} onChange={e => setNav(e.target.value)}
                style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'right' }} required />
            </div>
          </div>

          {/* Total display */}
          {total !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: `${activeType.color}12`, border: `1px solid ${activeType.color}40` }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{units} units × ₹{nav}</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: activeType.color }}>{fmt(total)}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Folio Number (optional)</label>
            <input type="text" className="form-input" placeholder="e.g. 12345678/12" value={folioNum} onChange={e => setFolioNum(e.target.value)} />
          </div>
        </div></div>

        {/* Date + Note */}
        <div className="card"><div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Trade Date *</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Note (optional)</label>
            <textarea className="form-input" rows={2} placeholder="e.g. Monthly SIP, Goal: Retirement…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div></div>
      </>)}

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {step === 'trade' && (
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
          <button type="submit" disabled={loading}
            style={{ flex: 1, padding: '14px 24px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${activeType.color}, ${activeType.color}cc)`, color: '#fff', boxShadow: `0 4px 20px ${activeType.color}44`, transition: 'all 0.2s' }}>
            {loading ? 'Saving…' : `Record ${activeType.label}`}
          </button>
          <Link href={`/portfolios/${portfolioId}`} style={{ padding: '14px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
            Cancel
          </Link>
        </div>
      )}
    </form>
  )
}
