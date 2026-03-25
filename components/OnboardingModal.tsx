'use client'

/**
 * OnboardingModal — fullscreen blocking modal shown to new users.
 * 5 slides: Welcome → Features → Choose Path → [CAS|CSV|Manual] → Done
 * Cannot be dismissed without completing a path.
 * On completion, calls /api/onboarding-complete and unmounts.
 */

import { useState, useCallback } from 'react'
import { ASSET_CLASS_LIST } from '@/lib/assetClasses'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput, { SearchResult } from '@/components/SecuritySearchInput'

// ── Types ────────────────────────────────────────────────────────────────────
type Path   = 'cas' | 'csv' | 'manual' | null
type Status = 'idle' | 'loading' | 'done' | 'error'

// ── Tiny helpers ─────────────────────────────────────────────────────────────
const Dot = ({ active, done }: { active: boolean; done: boolean }) => (
  <div style={{
    width: active ? 20 : 8, height: 8, borderRadius: 4,
    background: done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.2)',
    transition: 'all 0.3s',
  }} />
)

// ── Main Component ────────────────────────────────────────────────────────────
export default function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [slide, setSlide]   = useState(0)
  const [path, setPath]     = useState<Path>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errMsg, setErrMsg] = useState('')

  // Manual path state
  const [picked, setPicked]       = useState<SearchResult | null>(null)
  const [units, setUnits]         = useState('')
  const [price, setPrice]         = useState('')
  const [priceLoading, setPriceLoading] = useState(false)
  const [date,  setDate]          = useState(new Date().toISOString().split('T')[0])

  // CAS path state
  const [casFile, setCasFile]     = useState<File | null>(null)
  const [casPassword, setCasPassword] = useState('')
  const [casResult, setCasResult] = useState<{ funds: number; transactions: number } | null>(null)

  const supabase = createClient()

  // Mark complete in DB + notify parent
  const markComplete = useCallback(async () => {
    await fetch('/api/onboarding-complete', { method: 'POST' })
    onComplete()
  }, [onComplete])

  // When a stock is selected, auto-fetch its latest NSE close price
  const handleStockSelect = async (r: SearchResult) => {
    setPicked(r)
    setPriceLoading(true)
    setPrice('')
    const { data } = await supabase
      .from('nse_market_data')
      .select('close_price, date')
      .eq('symbol', r.symbol)
      .order('date', { ascending: false })
      .limit(1)
      .single()
    if (data?.close_price) {
      setPrice(String(data.close_price))
    }
    setPriceLoading(false)
  }

  // Manual submit — creates security + BUY transaction using defaults
  const submitManual = async () => {
    if (!picked || !units || !price || !date) { setErrMsg('Please fill all fields'); return }
    setStatus('loading'); setErrMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Find default EQUITY portfolio
      const { data: portfolios } = await supabase
        .from('portfolios').select('id').eq('asset_class', 'EQUITY').limit(1)
      const { data: accounts } = await supabase
        .from('accounts').select('id').limit(1)
      if (!portfolios?.length || !accounts?.length) throw new Error('No default portfolio found')

      // Upsert security (type cast to avoid strict TS check on generated types)
      const { data: sec, error: secErr } = await supabase
        .from('securities')
        .upsert(
          { user_id: user.id, name: picked.name, ticker_symbol: picked.symbol, currency_code: 'INR' } as never,
          { onConflict: 'ticker_symbol,user_id' }
        )
        .select('id').single()
      if (secErr) throw secErr

      // Insert BUY transaction (cast to never to handle account_id not in generated types)
      const shares  = Math.round(parseFloat(units) * 100_000_000)
      const amount  = Math.round(parseFloat(price) * parseFloat(units) * 100)
      const { error: txErr } = await supabase.from('portfolio_transactions').insert({
        portfolio_id:  portfolios[0].id,
        account_id:    accounts[0].id,
        security_id:   sec.id,
        type:          'BUY',
        currency_code: 'INR',
        shares,
        amount,
        date,
      } as never)
      if (txErr) throw txErr
      setStatus('done')
      setSlide(4)
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  // CAS PDF submit
  const submitCAS = async () => {
    if (!casFile) { setErrMsg('Please select a PDF file'); return }
    setStatus('loading'); setErrMsg('')
    try {
      const fd = new FormData()
      fd.append('pdf', casFile)
      if (casPassword) fd.append('password', casPassword)
      const res = await fetch('/api/cas-import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setCasResult(json.summary)
      setStatus('done')
      setSlide(4)
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Import failed')
      setStatus('error')
    }
  }

  // ── Slide content ───────────────────────────────────────────────────────────
  const slides: React.ReactNode[] = [

    // Slide 0 — Welcome
    <div key="welcome" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'pulse 2s infinite' }}>📊</div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>
        Welcome to Apna Stocks
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.65, maxWidth: 400, margin: '0 auto 28px' }}>
        Your complete investment picture — stocks, mutual funds, gold,
        fixed deposits, and real estate — all in one place.
      </p>
      {/* Asset class icons ticker */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 36, fontSize: '1.8rem' }}>
        {ASSET_CLASS_LIST.map(ac => (
          <div key={ac.id} title={ac.label} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}>
            {ac.icon}
          </div>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={btnPrimary}>
        Get Started →
      </button>
    </div>,

    // Slide 1 — Features
    <div key="features" style={{ width: '100%' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>What you get</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: '0.88rem', marginBottom: 28 }}>
        Built for Indian investors who want to see real returns
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
        {[
          { icon: '📈', title: 'True Returns (XIRR)', body: 'Accounts for when you invested each rupee — not just simple % gain' },
          { icon: '🗂', title: 'Every Asset Class', body: 'Stocks, MFs, Gold, FDs, Real Estate — one unified view' },
          { icon: '🔔', title: 'Price Alerts', body: 'Set buy / sell target prices on your watchlist and get notified' },
          { icon: '📋', title: 'Gains & Tax', body: 'Realised vs unrealised, LTCG vs STCG — ready for ITR season' },
        ].map(f => (
          <div key={f.title} style={{
            background: 'rgba(255,255,255,0.07)', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)', padding: '16px 14px',
          }}>
            <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setSlide(0)} style={btnSecondary}>← Back</button>
        <button onClick={() => setSlide(2)} style={{ ...btnPrimary, flex: 1 }}>Continue →</button>
      </div>
    </div>,

    // Slide 2 — Choose path
    <div key="choose" style={{ width: '100%' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>Get your data in</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: '0.88rem', marginBottom: 24 }}>
        Choose how you'd like to start
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {[
          {
            id: 'cas' as Path, icon: '📂',
            title: 'CAS Statement (Mutual Funds)',
            desc: 'Upload your CAMS / KFintech CAS PDF — auto-imports all your MF holdings and transaction history',
          },
          {
            id: 'csv' as Path, icon: '📤',
            title: 'Upload Trade CSV',
            desc: 'Import a trade history CSV from Kuvera, Groww, Zerodha, or any broker',
          },
          {
            id: 'manual' as Path, icon: '✏️',
            title: 'Add Manually',
            desc: 'Type in your first holding right now — takes 30 seconds',
          },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setPath(opt.id); setSlide(3) }} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.07)', cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.15s, border-color 0.15s',
            color: 'white',
          }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{opt.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={btnSecondary}>← Back</button>
    </div>,

    // Slide 3 — Path-specific
    <div key="path" style={{ width: '100%' }}>
      {path === 'manual' && (
        <>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>✏️ Add your first holding</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 20 }}>
            We'll add it to your default Stocks portfolio automatically.
          </p>

          {/* Stock search — uses SecuritySearchInput with dark-theme overrides */}
          <style>{`
            .onb-search .search-container { position: relative; }
            .onb-search input {
              background: rgba(255,255,255,0.08) !important;
              border: 1px solid rgba(255,255,255,0.2) !important;
              color: white !important;
              border-radius: 10px !important;
            }
            .onb-search input::placeholder { color: rgba(255,255,255,0.4) !important; }
            .onb-search [role="listbox"], .onb-search [class*="results"], .onb-search ul {
              background: #1e2035 !important;
              border: 1px solid rgba(255,255,255,0.15) !important;
            }
            .onb-search [role="option"], .onb-search li {
              color: white !important;
            }
            .onb-search [role="option"]:hover, .onb-search li:hover {
              background: rgba(255,255,255,0.08) !important;
            }
          `}</style>

          <div className="onb-search" style={{ marginBottom: 14 }}>
            {picked ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.12)',
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{picked.symbol}</span>
                  {' '}
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{picked.name}</span>
                  {picked.sector && (
                    <span style={{
                      marginLeft: 8, fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)',
                    }}>{picked.sector}</span>
                  )}
                </div>
                <button onClick={() => setPicked(null)} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', fontSize: '1rem', padding: '0 4px',
                }}>✕</button>
              </div>
            ) : (
              <SecuritySearchInput
                onSelect={handleStockSelect}
                placeholder="Search: Reliance, TCS, HDFC Bank, Nifty BeES…"
              />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Units</label>
              <input type="number" placeholder="100" value={units} onChange={e => setUnits(e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>
                Price (₹)
                {priceLoading && <span style={{ marginLeft: 6, opacity: 0.5, fontSize: '0.68rem' }}>fetching…</span>}
                {!priceLoading && price && <span style={{ marginLeft: 6, opacity: 0.5, fontSize: '0.68rem' }}>current price — edit if different</span>}
              </label>
              <input
                type="number"
                placeholder={priceLoading ? 'Fetching price…' : '2350'}
                value={price}
                onChange={e => setPrice(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: (!priceLoading && price) ? 'rgba(99,102,241,0.5)' : undefined,
                }}
                min="0" step="any"
              />
            </div>
            <div>
              <label style={labelStyle}>Buy Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {errMsg && <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 10 }}>{errMsg}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSlide(2)} style={btnSecondary}>← Back</button>
            <button onClick={submitManual} disabled={status === 'loading'} style={{ ...btnPrimary, flex: 1, opacity: status === 'loading' ? 0.7 : 1 }}>
              {status === 'loading' ? '⏳ Adding…' : 'Add & Continue →'}
            </button>
          </div>
        </>
      )}

      {path === 'cas' && (
        <>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>📂 Upload CAS PDF</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.6 }}>
            Download your CAS from{' '}
            <a href="https://www.mfcentral.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>mfcentral.com</a>
            {' '}or from your CAMS / KFintech inbox.
          </p>
          <label style={{
            display: 'block', border: '2px dashed rgba(255,255,255,0.2)',
            borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer',
            marginBottom: 14, transition: 'border-color 0.15s',
          }}>
            <input type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => setCasFile(e.target.files?.[0] ?? null)} />
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: '0.88rem', color: casFile ? '#86efac' : 'rgba(255,255,255,0.6)' }}>
              {casFile ? `✓ ${casFile.name}` : 'Click to browse or drop PDF here'}
            </div>
          </label>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>PDF Password (if protected)</label>
            <input type="password" placeholder="Usually PAN + DOB e.g. ABCDE1234F01011990"
              value={casPassword} onChange={e => setCasPassword(e.target.value)} style={inputStyle} />
          </div>
          {errMsg && <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 10 }}>{errMsg}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSlide(2)} style={btnSecondary}>← Back</button>
            <button onClick={submitCAS} disabled={status === 'loading' || !casFile}
              style={{ ...btnPrimary, flex: 1, opacity: (status === 'loading' || !casFile) ? 0.6 : 1 }}>
              {status === 'loading' ? '⏳ Importing…' : 'Upload & Import →'}
            </button>
          </div>
        </>
      )}

      {path === 'csv' && (
        <>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>📤 Import Trade CSV</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 20 }}>
            We'll take you to the import page. Come back here when you&apos;re done.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSlide(2)} style={btnSecondary}>← Back</button>
            <a href="/import" style={{ ...btnPrimary, flex: 1, textDecoration: 'none', textAlign: 'center' }}
              onClick={markComplete}>
              Go to Import →
            </a>
          </div>
          <button onClick={markComplete} style={{ ...btnSecondary, width: '100%', marginTop: 10, textAlign: 'center' }}>
            Skip — I'll do this later
          </button>
        </>
      )}
    </div>,

    // Slide 4 — Done
    <div key="done" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10 }}>You&apos;re all set!</h2>
      {casResult && (
        <div style={{
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 12, padding: '12px 20px', marginBottom: 20, fontSize: '0.88rem', color: '#86efac',
        }}>
          ✓ Imported {casResult.funds} funds · {casResult.transactions} transactions
        </div>
      )}
      {path === 'manual' && (
        <div style={{
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 12, padding: '12px 20px', marginBottom: 20, fontSize: '0.88rem', color: '#86efac',
        }}>
          ✓ Your first holding has been added
        </div>
      )}
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
        Your portfolio is live. You can add more holdings, explore your
        analytics, and set price alerts — all from the dashboard.
      </p>
      <button onClick={markComplete} style={{ ...btnPrimary, width: '100%' }}>
        Go to Dashboard →
      </button>
    </div>,
  ]

  const totalSlides = 5

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      {/* Fullscreen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #0f1022 0%, #1a1a3e 50%, #0d1a2e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 520, color: 'white',
          animation: 'fadeUp 0.4s ease-out',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 40 }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <Dot key={i} active={i === slide} done={i < slide} />
            ))}
          </div>

          {/* Slide content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {slides[slide]}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  padding: '13px 24px', borderRadius: 12, border: 'none',
  background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.92rem',
  cursor: 'pointer', transition: 'opacity 0.15s', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
}
const btnSecondary: React.CSSProperties = {
  padding: '12px 18px', borderRadius: 12, fontWeight: 600, fontSize: '0.88rem',
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.8)', cursor: 'pointer', transition: 'background 0.15s',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
  color: 'white', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.5)', marginBottom: 5,
}
