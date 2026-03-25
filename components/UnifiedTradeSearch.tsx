'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput, { type SearchResult } from '@/components/SecuritySearchInput'
import { ASSET_CLASS_ICONS, ASSET_CLASS_LABELS } from '@/lib/assetClasses'

interface Portfolio {
  id: string
  name: string
  asset_class: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function UnifiedTradeSearch({ open, onClose }: Props) {
  const router  = useRouter()
  const supabase = createClient()

  const [step,        setStep]        = useState<'search' | 'portfolio'>('search')
  const [selected,    setSelected]    = useState<SearchResult | null>(null)
  const [portfolios,  setPortfolios]  = useState<Portfolio[]>([])
  const [creating,    setCreating]    = useState(false)
  const [loadingPf,   setLoadingPf]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)

  // Load portfolios when modal opens
  useEffect(() => {
    if (!open) return
    setStep('search')
    setSelected(null)
    setError(null)
    setLoadingPf(true)
    supabase
      .from('portfolios')
      .select('id, name, asset_class')
      .eq('is_retired', false)
      .order('name')
      .then(({ data }) => {
        setPortfolios((data as unknown as Portfolio[] | null) ?? [])
        setLoadingPf(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleSecuritySelect = (result: SearchResult) => {
    setSelected(result)
    setStep('portfolio')
    setError(null)
  }

  const handlePortfolioSelect = async (portfolio: Portfolio) => {
    if (!selected) return
    setCreating(true)
    setError(null)

    try {
      // Find or create the security
      const { data: existing } = await supabase
        .from('securities')
        .select('id')
        .eq('ticker_symbol', selected.symbol)
        .maybeSingle()

      let securityId: string
      if (existing) {
        securityId = existing.id
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: created, error: cErr } = await supabase
          .from('securities')
          .insert({
            user_id:       user!.id,
            name:          selected.name,
            ticker_symbol: selected.symbol,
            currency_code: selected.currency ?? 'INR',
            feed:          'YAHOO',
          })
          .select('id')
          .single()
        if (cErr || !created) throw new Error(cErr?.message ?? 'Could not create security')
        securityId = created.id
      }

      onClose()
      router.push(`/portfolios/${portfolio.id}/transactions/new?security_id=${securityId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--color-bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {step === 'search' ? (
                <>↑↓ Record a Trade</>
              ) : (
                <button
                  onClick={() => { setStep('search'); setSelected(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-light)', fontSize: '0.875rem', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  ← Back
                </button>
              )}
            </div>
            {step === 'portfolio' && selected && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  {selected.name}
                </span>
                <code style={{ fontSize: '0.7rem', color: 'var(--color-accent-light)', background: 'var(--color-accent-glow)', padding: '1px 7px', borderRadius: 4 }}>
                  {selected.symbol}
                </code>
                {selected.currency && (
                  <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontWeight: 600 }}>
                    {selected.currency}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '1.2rem',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {/* Step 1: Search */}
          {step === 'search' && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Search any NSE/BSE stock, ETF, or mutual fund
              </p>
              <SecuritySearchInput
                onSelect={handleSecuritySelect}
                placeholder="Search: Reliance, TCS, HDFC Bank, Nifty BeES…"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 10 }}>
                Tip: can&apos;t find it? Go to <a href="/securities/new" style={{ color: 'var(--color-accent-light)' }}>Add Security</a> to enter manually.
              </p>
            </div>
          )}

          {/* Step 2: Portfolio Picker */}
          {step === 'portfolio' && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                Which portfolio should this trade go into?
              </p>

              {loadingPf ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {portfolios.map(p => {
                    const ac   = p.asset_class ?? 'EQUITY'
                    const icon = ASSET_CLASS_ICONS[ac] ?? '📊'
                    const lbl  = ASSET_CLASS_LABELS[ac] ?? ac
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePortfolioSelect(p)}
                        disabled={creating}
                        style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          borderRadius: 10,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-card)',
                          cursor: creating ? 'wait' : 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                          opacity: creating ? 0.6 : 1,
                        }}
                        onMouseEnter={e => {
                          if (!creating) {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'
                            ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'
                          }
                        }}
                        onMouseLeave={e => {
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'
                          ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'
                        }}
                      >
                        <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lbl}</div>
                      </button>
                    )
                  })}
                </div>
              )}

              {creating && (
                <div style={{ marginTop: 14, fontSize: '0.82rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Adding security record…
                </div>
              )}

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--color-danger)', fontSize: '0.82rem' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
