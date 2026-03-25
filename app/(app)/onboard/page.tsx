'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ASSET_CLASSES = [
  { id: 'EQUITY',       icon: '📈', label: 'Stocks & ETFs',   desc: 'NSE / BSE listed shares, mutual funds, ETFs' },
  { id: 'FIXED_INCOME', icon: '🏦', label: 'Fixed Income',    desc: 'Fixed Deposits, Bonds, PPF, NSC, Debentures' },
  { id: 'COMMODITY',    icon: '🥇', label: 'Commodities',     desc: 'Gold, Silver, Oil — physical or via ETF' },
  { id: 'REAL_ESTATE',  icon: '🏠', label: 'Real Estate',     desc: 'Property: residential, commercial, REITs' },
]

const STEPS = ['What do you invest in?', 'Name your first portfolio', 'You\'re ready!']

export default function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['EQUITY'])
  const [portfolioName, setPortfolioName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCreate = async () => {
    if (!selectedClasses.length) { setError('Pick at least one asset class'); return }
    const name = portfolioName.trim() || (ASSET_CLASSES.find(a => a.id === selectedClasses[0])?.label ?? 'My Portfolio')
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, asset_class: selectedClasses[0] }),
      })
      if (!res.ok) throw new Error('Could not create portfolio')
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--color-bg-page)',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📊</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Welcome to Apna Stocks</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 6, fontSize: '0.92rem' }}>
            Let's set up your portfolio in under a minute.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.78rem',
                background: i < step ? 'var(--color-success)' : i === step ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
                color: i <= step ? '#fff' : 'var(--color-text-muted)',
                border: i === step ? 'none' : '1px solid var(--color-border)',
                transition: 'all 0.2s',
              }}>{i < step ? '✓' : i + 1}</div>
              <span style={{ fontSize: '0.75rem', color: i === step ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: i === step ? 600 : 400, display: step === 2 && i === 2 ? undefined : 'none' }}>{label}</span>
              {i < STEPS.length - 1 && <div style={{ width: 32, height: 1, background: i < step ? 'var(--color-success)' : 'var(--color-border)', transition: 'all 0.2s' }} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
          borderRadius: 20, padding: '32px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        }}>

          {/* ── Step 0: Pick asset classes ── */}
          {step === 0 && (
            <>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6 }}>What do you invest in?</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 24 }}>
                Select all that apply — you can add more asset classes later.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ASSET_CLASSES.map(ac => {
                  const sel = selectedClasses.includes(ac.id)
                  return (
                    <button key={ac.id} onClick={() => toggle(ac.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 18px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: sel ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                      background: sel ? 'rgba(99,102,241,0.08)' : 'var(--color-bg-page)',
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{ac.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: sel ? 'var(--color-accent-light)' : 'var(--color-text-primary)' }}>{ac.label}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{ac.desc}</div>
                      </div>
                      {sel && <span style={{ marginLeft: 'auto', color: 'var(--color-accent-light)', fontSize: '1.1rem' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
              {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginTop: 12 }}>{error}</div>}
              <button
                onClick={() => { if (!selectedClasses.length) { setError('Select at least one'); return } setError(null); setStep(1) }}
                style={{
                  marginTop: 24, width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                  background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                  cursor: 'pointer', transition: 'opacity 0.15s',
                }}
              >Continue →</button>
            </>
          )}

          {/* ── Step 1: Name portfolio ── */}
          {step === 1 && (
            <>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6 }}>Name your portfolio</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 24 }}>
                We'll create one portfolio for <strong>{ASSET_CLASSES.find(a => a.id === selectedClasses[0])?.label}</strong> to start. You can add more later.
              </p>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Portfolio name
              </label>
              <input
                type="text" autoFocus
                placeholder={ASSET_CLASSES.find(a => a.id === selectedClasses[0])?.label ?? 'My Portfolio'}
                value={portfolioName}
                onChange={e => setPortfolioName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: '0.95rem',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-page)',
                  color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box',
                }}
              />

              {selectedClasses.length > 1 && (
                <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-bg-page)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  💡 You selected {selectedClasses.length} asset classes. We'll create separate portfolios for each after setup.
                </div>
              )}

              {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginTop: 10 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(0)} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
                <button onClick={handleCreate} disabled={loading} style={{
                  flex: 1, padding: '13px', borderRadius: 10, border: 'none',
                  background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                  cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
                }}>{loading ? '⏳ Creating…' : 'Create Portfolio →'}</button>
              </div>
            </>
          )}

          {/* ── Step 2: Done ── */}
          {step === 2 && (
            <>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 8 }}>You're all set!</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 28px' }}>
                  Your portfolio is ready. Now record your first trade to start tracking your investments.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => router.push('/portfolios')} style={{
                    padding: '13px', borderRadius: 10, border: 'none',
                    background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                    cursor: 'pointer', width: '100%',
                  }}>📈 Record My First Trade</button>
                  <button onClick={() => router.push('/')} style={{
                    padding: '12px', borderRadius: 10, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-muted)', fontWeight: 600,
                    cursor: 'pointer', fontSize: '0.9rem', width: '100%',
                  }}>Go to Dashboard</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Skip link */}
        {step < 2 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Skip for now → go to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
