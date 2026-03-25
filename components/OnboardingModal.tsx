'use client'

/**
 * OnboardingModal — fullscreen blocking modal shown to new users.
 * 5 slides: Welcome → Features → Choose Path → [CAS|CSV|Manual] → Done
 * Cannot be dismissed without completing a path.
 * On completion, calls /api/onboarding-complete and unmounts.
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  const router  = useRouter()
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
    <div key="welcome" style={{ textAlign: 'center', width: '100%' }}>
      {/* Large portrait */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%', margin: '10%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
          filter: 'blur(24px)',
        }} />
        <img
          src="/onboarding/welcome.png"
          alt="Welcome to Apna Stocks"
          style={{
            width: 260, height: 310, objectFit: 'cover', objectPosition: 'top',
            borderRadius: 28,
            boxShadow: '0 24px 70px rgba(99,102,241,0.35), 0 4px 20px rgba(0,0,0,0.5)',
            animation: 'floatY 4s ease-in-out infinite',
            display: 'block',
          }}
        />
      </div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8, marginTop: 4 }}>
        Welcome to Apna Stocks
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.65, maxWidth: 380, margin: '0 auto 20px' }}>
        Your complete investment picture — one beautiful dashboard for every rupee you own.
      </p>
      {/* Asset class chips — icon + label, nothing hidden */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        {ASSET_CLASS_LIST.map(ac => (
          <div key={ac.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '6px 12px',
          }}>
            <span style={{ fontSize: '1rem' }}>{ac.icon}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{ac.label}</span>
          </div>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={{ ...btnPrimary, width: '100%' }}>
        Let's Start →
      </button>
    </div>,

    // Slide 1 — Features
    <div key="features" style={{ width: '100%', textAlign: 'center' }}>
      {/* Hero portrait — large and centered */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
        <div style={{
          position: 'absolute', inset: 0, margin: '10%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 70%)',
          filter: 'blur(24px)',
        }} />
        <img
          src="/onboarding/features.png"
          alt="Your complete investment toolkit"
          style={{
            width: 220, height: 260, objectFit: 'cover', objectPosition: 'top',
            borderRadius: 28,
            boxShadow: '0 24px 70px rgba(139,92,246,0.35), 0 4px 20px rgba(0,0,0,0.5)',
            display: 'block',
          }}
        />
      </div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>Your complete toolkit</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', marginBottom: 18, lineHeight: 1.5 }}>
        Built for Indian investors who want real returns, not just paper gains
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, textAlign: 'left' }}>
        {[
          { icon: '📈', title: 'True Returns (XIRR)', body: 'Accounts for when you invested each rupee' },
          { icon: '🗂', title: 'Every Asset Class', body: 'Stocks, MFs, Gold, FDs, Real Estate' },
          { icon: '🔔', title: 'Price Alerts', body: 'Buy / sell targets on your watchlist' },
          { icon: '📋', title: 'Gains & Tax', body: 'LTCG vs STCG — ready for ITR season' },
        ].map(f => (
          <div key={f.title} style={{
            background: 'rgba(255,255,255,0.07)', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)', padding: '14px 12px',
          }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 3 }}>{f.title}</div>
            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{f.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setSlide(0)} style={btnSecondary}>← Back</button>
        <button onClick={() => setSlide(2)} style={{ ...btnPrimary, flex: 1 }}>Continue →</button>
      </div>
    </div>,

    // Slide 2 — Choose path
    <div key="choose" style={{ width: '100%', textAlign: 'center' }}>
      {/* Hero portrait */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
        <div style={{
          position: 'absolute', inset: 0, margin: '10%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
          filter: 'blur(24px)',
        }} />
        <img
          src="/onboarding/choose.png"
          alt="How would you like to get started?"
          style={{
            width: 220, height: 260, objectFit: 'cover', objectPosition: 'top',
            borderRadius: 28,
            boxShadow: '0 24px 70px rgba(99,102,241,0.3), 0 4px 20px rgba(0,0,0,0.5)',
            display: 'block',
          }}
        />
      </div>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>How would you like to start?</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 18 }}>
        Pick the fastest path for you
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18, textAlign: 'left' }}>
        {[
          {
            id: 'cas' as Path, icon: '📂',
            title: 'CAS Statement (Mutual Funds)',
            desc: 'Upload your CAMS / KFintech PDF — imports everything automatically',
          },
          {
            id: 'csv' as Path, icon: '📤',
            title: 'Upload Trade CSV',
            desc: 'From Kuvera, Groww, Zerodha or any broker',
          },
          {
            id: 'manual' as Path, icon: '✏️',
            title: 'Add a Holding Manually',
            desc: 'Type in your first stock — takes 30 seconds',
          },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setPath(opt.id); setSlide(3) }} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.07)', cursor: 'pointer', textAlign: 'left',
            color: 'white',
          }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 3 }}>{opt.title}</div>
              <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{opt.desc}</div>
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
          {/* Guide image beside heading */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
                filter: 'blur(14px)',
              }} />
              <img
                src="/onboarding/manual.png"
                alt="Add your first holding"
                style={{
                  width: 100, height: 130, objectFit: 'cover', objectPosition: 'top',
                  borderRadius: 18,
                  boxShadow: '0 12px 40px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.4)',
                  display: 'block',
                }}
              />
            </div>
            <div style={{ paddingTop: 4 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6 }}>✏️ Add your first holding</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                We'll add it to your default Stocks portfolio automatically — no setup needed.
              </p>
            </div>
          </div>

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
          {/* Guide image beside heading */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
                filter: 'blur(14px)',
              }} />
              <img
                src="/onboarding/choose.png"
                alt="Upload your CAS PDF"
                style={{
                  width: 100, height: 130, objectFit: 'cover', objectPosition: 'top',
                  borderRadius: 18,
                  boxShadow: '0 12px 40px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.4)',
                  display: 'block',
                }}
              />
            </div>
            <div style={{ paddingTop: 4 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6 }}>📂 Upload CAS PDF</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                Download from{' '}
                <a href="https://www.mfcentral.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>mfcentral.com</a>
                {' '}or from your CAMS / KFintech inbox.
              </p>
            </div>
          </div>
          <label style={{
            display: 'block', border: '2px dashed rgba(255,255,255,0.2)',
            borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer',
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
          {/* Guide image beside heading */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
                filter: 'blur(14px)',
              }} />
              <img
                src="/onboarding/features.png"
                alt="Import your trade CSV"
                style={{
                  width: 100, height: 130, objectFit: 'cover', objectPosition: 'top',
                  borderRadius: 18,
                  boxShadow: '0 12px 40px rgba(139,92,246,0.3), 0 4px 12px rgba(0,0,0,0.4)',
                  display: 'block',
                }}
              />
            </div>
            <div style={{ paddingTop: 4 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6 }}>📤 Import Trade CSV</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                We&apos;ll mark your setup complete and take you straight to the import page — your data will be ready in minutes.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSlide(2)} style={btnSecondary}>← Back</button>
            <button
              onClick={async () => {
                await markComplete()
                router.push('/import')
              }}
              style={{ ...btnPrimary, flex: 1 }}
            >
              Go to Import →
            </button>
          </div>
          <button onClick={markComplete} style={{ ...btnSecondary, width: '100%', marginTop: 10, textAlign: 'center' }}>
            Skip — I&apos;ll do this later
          </button>
        </>
      )}
    </div>,


    // Slide 4 — Done
    <div key="done" style={{ textAlign: 'center', width: '100%' }}>
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
        <div style={{
          position: 'absolute', inset: 0, margin: '10%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }} />
        <img
          src="/onboarding/done.png"
          alt="Celebrating your investment journey"
          style={{
            width: 260, height: 310, objectFit: 'cover', objectPosition: 'top',
            borderRadius: 28,
            boxShadow: '0 24px 70px rgba(34,197,94,0.3), 0 4px 20px rgba(0,0,0,0.5)',
            animation: 'floatY 4s ease-in-out infinite',
            display: 'block',
          }}
        />
      </div>
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
        @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatY  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      `}</style>
      {/* Fullscreen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #0f1022 0%, #1a1a3e 50%, #0d1a2e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 540, color: 'white',
          animation: 'fadeUp 0.4s ease-out',
          maxHeight: '90vh', overflowY: 'auto',
          paddingBottom: 8,
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
