'use client'

/**
 * OnboardingModal — full-screen immersive background with bottom-right glass card.
 * Buttons are consistently pinned to the bottom of the card on every slide.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ASSET_CLASS_LIST } from '@/lib/assetClasses'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput, { SearchResult, SecurityItem } from '@/components/SecuritySearchInput'

type Path   = 'cas' | 'csv' | 'manual' | null
type Status = 'idle' | 'loading' | 'done' | 'error'

// Prefetched securities list — loaded once, shared across remounts
let cachedSecurities: SecurityItem[] | null = null

const Dot = ({ active, done }: { active: boolean; done: boolean }) => (
  <div style={{
    width: active ? 24 : 8, height: 8, borderRadius: 4,
    background: done ? '#16a34a' : active ? '#6366f1' : 'rgba(0,0,0,0.15)',
    transition: 'all 0.3s',
  }} />
)

// Speech bubble — primary conversational text
const Speech = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: '1.05rem', lineHeight: 1.75, color: '#ffffff', margin: '0 0 22px', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
    {children}
  </p>
)

// Coloured icon box with gradient bg
const IconBox = ({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
    background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.45 + 'px', boxShadow: `0 4px 12px ${color}55`,
  }}>
    {icon}
  </div>
)

// Asset class colour map
const assetColors: Record<string, string> = {
  stocks:      'linear-gradient(135deg,#bbf7d0,#4ade80)',
  mutual_fund: 'linear-gradient(135deg,#bfdbfe,#60a5fa)',
  gold:        'linear-gradient(135deg,#fde68a,#fbbf24)',
  fixed_income:'linear-gradient(135deg,#e9d5ff,#a78bfa)',
  real_estate: 'linear-gradient(135deg,#fed7aa,#fb923c)',
}

export default function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const router  = useRouter()
  const [slide, setSlide]   = useState(0)
  const [path, setPath]     = useState<Path>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errMsg, setErrMsg] = useState('')

  const [picked, setPicked]             = useState<SearchResult | null>(null)
  const [units, setUnits]               = useState('')
  const [price, setPrice]               = useState('')
  const [priceLoading, setPriceLoading] = useState(false)
  const [date,  setDate]                = useState(new Date().toISOString().split('T')[0])
  const [casFile, setCasFile]           = useState<File | null>(null)
  const [casPassword, setCasPassword]   = useState('')
  const [casResult, setCasResult]       = useState<{ funds: number; transactions: number } | null>(null)
  const [secList, setSecList]           = useState<SecurityItem[]>(cachedSecurities ?? [])

  const supabase = createClient()

  // Prefetch all securities on mount (instant search afterwards)
  useEffect(() => {
    if (cachedSecurities) { setSecList(cachedSecurities); return }
    fetch('/api/securities-list').then(r => r.json()).then((list: SecurityItem[]) => {
      if (Array.isArray(list)) { cachedSecurities = list; setSecList(list) }
    }).catch(() => {})
  }, [])

  const markComplete = useCallback(async () => {
    await fetch('/api/onboarding-complete', { method: 'POST' })
    onComplete()
  }, [onComplete])

  const handleStockSelect = async (r: SearchResult) => {
    setPicked(r); setPriceLoading(true); setPrice('')
    const { data } = await supabase
      .from('nse_market_data').select('close_price')
      .eq('symbol', r.symbol).order('date', { ascending: false }).limit(1).single()
    if (data?.close_price) setPrice(String(data.close_price))
    setPriceLoading(false)
  }

  const submitManual = async () => {
    if (!picked || !units || !price || !date) { setErrMsg('Please fill all fields'); return }
    setStatus('loading'); setErrMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: portfolios } = await supabase.from('portfolios').select('id').eq('asset_class', 'EQUITY').limit(1)
      const { data: accounts }   = await supabase.from('accounts').select('id').limit(1)
      if (!portfolios?.length || !accounts?.length) throw new Error('No default portfolio found')
      const { data: sec, error: secErr } = await supabase
        .from('securities')
        .upsert({ user_id: user.id, name: picked.name, ticker_symbol: picked.symbol, currency_code: 'INR' } as never, { onConflict: 'ticker_symbol,user_id' })
        .select('id').single()
      if (secErr) throw secErr
      const { error: txErr } = await supabase.from('portfolio_transactions').insert({
        portfolio_id: portfolios[0].id, account_id: accounts[0].id,
        security_id: sec.id, type: 'BUY', currency_code: 'INR',
        shares: Math.round(parseFloat(units) * 100_000_000),
        amount: Math.round(parseFloat(price) * parseFloat(units) * 100), date,
      } as never)
      if (txErr) throw txErr
      setStatus('done'); setSlide(4)
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong'); setStatus('error')
    }
  }

  const submitCAS = async () => {
    if (!casFile) { setErrMsg('Please select a PDF'); return }
    setStatus('loading'); setErrMsg('')
    try {
      const fd = new FormData()
      fd.append('pdf', casFile)
      if (casPassword) fd.append('password', casPassword)
      const res  = await fetch('/api/cas-import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setCasResult(json.summary); setStatus('done'); setSlide(4)
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Import failed'); setStatus('error')
    }
  }

  const bgImage = `/onboarding/step${slide + 1}.jpg`

  // ── Crossfade between background images ─────────────────────────────────
  const [bottomBg, setBottomBg]     = useState(bgImage)
  const [topBg, setTopBg]           = useState<string | null>(null)
  const [topVisible, setTopVisible] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (bgImage === bottomBg) return
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    setTopBg(bgImage)
    setTopVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setTopVisible(true)))
    fadeTimer.current = setTimeout(() => {
      setBottomBg(bgImage); setTopBg(null); setTopVisible(false)
    }, 650)
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }
  }, [bgImage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (let i = 1; i <= 5; i++) { const img = new Image(); img.src = `/onboarding/step${i}.jpg` }
  }, [])

  // ── Panel layout helper — content grows, buttons always at bottom ────────────
  const Panel = ({ children, buttons }: { children: React.ReactNode; buttons: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ paddingTop: 16 }}>{buttons}</div>
    </div>
  )

  const features = [
    { icon: '📈', color: 'linear-gradient(135deg,#bbf7d0,#4ade80)', title: 'True Returns (XIRR)',
      body: 'Accounts for exactly when you invested each rupee — not a misleading simple % gain' },
    { icon: '🗂', color: 'linear-gradient(135deg,#bfdbfe,#60a5fa)', title: 'Every Asset Class',
      body: 'Stocks, Mutual Funds, Gold, Fixed Deposits, Real Estate — one unified view' },
    { icon: '🔔', color: 'linear-gradient(135deg,#fde68a,#fbbf24)', title: 'Smart Price Alerts',
      body: 'Set personalised buy / sell targets and get notified the moment they\'re hit' },
    { icon: '📋', color: 'linear-gradient(135deg,#e9d5ff,#a78bfa)', title: 'Gains & Tax Report',
      body: 'Realised vs unrealised, LTCG vs STCG — ready for ITR season, no manual work' },
  ]

  const paths = [
    { id: 'cas' as Path, icon: '📂', color: 'linear-gradient(135deg,#bfdbfe,#60a5fa)',
      title: 'CAS Statement', subtitle: 'Mutual Funds', desc: 'Upload your CAMS or KFintech PDF — I\'ll import your complete MF transaction history automatically.' },
    { id: 'csv' as Path, icon: '📤', color: 'linear-gradient(135deg,#bbf7d0,#4ade80)',
      title: 'Trade CSV', subtitle: 'Any Broker', desc: 'Import from Kuvera, Groww, Zerodha, or any broker that exports CSV trade history.' },
    { id: 'manual' as Path, icon: '✏️', color: 'linear-gradient(135deg,#fed7aa,#fb923c)',
      title: 'Add Manually', subtitle: 'Quick Start', desc: 'Type in your first holding right now. I\'ll fetch the current price — takes under 30 seconds.' },
  ]

  const panels = [

    // 0 — Welcome
    <Panel key={0}
      buttons={
        <button onClick={() => setSlide(1)} style={{ ...btnPrimary, width: '100%' }}>
          Let&apos;s get started →
        </button>
      }
    >
      <Speech>
        👋 <strong>Welcome to Apna Stocks!</strong><br />
        We bring your complete investment picture together — every rupee, every asset, in one place.
      </Speech>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {ASSET_CLASS_LIST.map(ac => (
          <div key={ac.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 14,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <IconBox icon={ac.icon} color={assetColors[ac.id] ?? 'linear-gradient(135deg,#e5e7eb,#d1d5db)'} size={40} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>{ac.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Track &amp; analyse</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>,

    // 1 — Features
    <Panel key={1}
      buttons={
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setSlide(0)} style={btnSecondary}>← Back</button>
          <button onClick={() => setSlide(2)} style={{ ...btnPrimary, flex: 1 }}>Sounds great →</button>
        </div>
      }
    >
      <Speech>
        This isn&apos;t just a tracker — it&apos;s a proper investment command centre
        built for Indian investors who want <strong>real numbers</strong>.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map(f => (
          <div key={f.title} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <IconBox icon={f.icon} color={f.color} size={44} />
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>{f.body}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>,

    // 2 — Choose path
    <Panel key={2}
      buttons={
        <button onClick={() => setSlide(1)} style={{ ...btnSecondary, width: '100%' }}>← Back</button>
      }
    >
      <Speech>
        Alright! Let&apos;s get your investments in. How would you like to start?
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paths.map(opt => (
          <button key={opt.id} onClick={() => { setPath(opt.id); setSlide(3) }} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
            borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'left', color: '#ffffff',
          }}>
            <IconBox icon={opt.icon} color={opt.color} size={44} />
            <div style={{ paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{opt.title}</span>
                <span style={{ fontSize: '0.70rem', fontWeight: 600, color: '#6366f1', background: 'rgba(99,102,241,0.10)', borderRadius: 6, padding: '2px 7px' }}>{opt.subtitle}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Panel>,

    // 3 — Path detail
    <Panel key={3}
      buttons={
        <>
          {path === 'manual' && (
            <>
              {errMsg && <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginBottom: 8 }}>{errMsg}</div>}
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
              {errMsg && <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginBottom: 8 }}>{errMsg}</div>}
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
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <button onClick={() => setSlide(2)} style={btnSecondary}>← Back</button>
                <button onClick={async () => { await markComplete(); router.push('/import') }} style={{ ...btnPrimary, flex: 1 }}>
                  Go to Import →
                </button>
              </div>
              <button onClick={markComplete} style={{ ...btnSecondary, width: '100%', textAlign: 'center' }}>
                Skip — I&apos;ll do this later
              </button>
            </>
          )}
        </>
      }
    >
      {path === 'manual' && (
        <>
          <Speech>
            Search for the stock you own — I&apos;ll fetch today&apos;s price automatically.
            Just fill in how many units you hold and when you bought them.
          </Speech>
          <div style={{ marginBottom: 12 }}>
            {picked ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.07)' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>{picked.symbol}</span>
                  {' '}<span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{picked.name}</span>
                </div>
                <button onClick={() => setPicked(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
              </div>
            ) : (
              <SecuritySearchInput onSelect={handleStockSelect} placeholder="Search: Reliance, TCS, HDFC Bank…" lightTheme prefetchedList={secList} />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Units</label>
              <input type="number" placeholder="100" value={units} onChange={e => setUnits(e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>
                Price ₹
                {priceLoading && <span style={{ marginLeft: 4, fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)' }}>fetching…</span>}
                {!priceLoading && price && <span style={{ marginLeft: 4, fontSize: '0.62rem', color: '#6366f1' }}>auto-filled</span>}
              </label>
              <input type="number" placeholder="2350" value={price} onChange={e => setPrice(e.target.value)}
                style={{ ...inputStyle, borderColor: (!priceLoading && price) ? 'rgba(99,102,241,0.5)' : undefined }} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>Buy Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </>
      )}

      {path === 'cas' && (
        <>
          <Speech>
            Download your CAS from{' '}
            <a href="https://www.mfcentral.com" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>mfcentral.com</a>
            {' '}or check your CAMS / KFintech email.
            The PDF password is usually your PAN followed by your date of birth.
          </Speech>
          <label style={{ display: 'block', border: '2px dashed rgba(255,255,255,0.25)', borderRadius: 14, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, background: 'rgba(255,255,255,0.05)' }}>
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setCasFile(e.target.files?.[0] ?? null)} />
            <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: casFile ? '#4ade80' : 'rgba(255,255,255,0.6)' }}>{casFile ? `✓ ${casFile.name}` : 'Click to browse or drop your PDF here'}</div>
          </label>
          <div>
            <label style={labelStyle}>PDF Password (if protected)</label>
            <input type="password" placeholder="e.g. ABCDE1234F01011990" value={casPassword} onChange={e => setCasPassword(e.target.value)} style={inputStyle} />
          </div>
        </>
      )}

      {path === 'csv' && (
        <Speech>
          I&apos;ll mark your setup complete and open the import page.
          It walks you through mapping your broker&apos;s columns step by step —
          your data will be ready in just a few minutes.
        </Speech>
      )}
    </Panel>,

    // 4 — Done
    <Panel key={4}
      buttons={
        <button onClick={markComplete} style={{ ...btnPrimary, width: '100%', fontSize: '1rem', padding: '15px 24px' }}>
          Go to my Dashboard →
        </button>
      }
    >
      <div style={{ textAlign: 'center', paddingTop: 20 }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>🎉</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: 12, letterSpacing: '-0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
          You&apos;re all set!
        </h2>
        {casResult && (
          <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 12, padding: '12px 20px', marginBottom: 16, fontSize: '0.9rem', color: '#4ade80', fontWeight: 600 }}>
            ✓ Imported {casResult.funds} funds · {casResult.transactions} transactions
          </div>
        )}
        {path === 'manual' && (
          <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 12, padding: '12px 20px', marginBottom: 16, fontSize: '0.9rem', color: '#4ade80', fontWeight: 600 }}>
            ✓ Your first holding has been added
          </div>
        )}
        <Speech>
          Your dashboard is live. Check your returns, set price alerts,
          and explore your analytics — everything you need is right there.
        </Speech>
      </div>
    </Panel>,
  ]

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, animation: 'fadeIn 0.5s ease-out' }}>
        {/* Background crossfade — bottom layer stays visible while top fades in */}
        <img src={bottomBg} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        {topBg && (
          <img src={topBg} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: topVisible ? 1 : 0, transition: 'opacity 0.6s ease-in-out' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.45) 100%)' }} />

        {/* ── Glass card — bottom right ─────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 40, right: 40,
          width: 580,
          height: 560,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          padding: '24px 28px 24px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.5s ease-out',
          color: '#ffffff',
        }}>
          {/* Branding row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>📊</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff', letterSpacing: '-0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>Apna Stocks</div>
              <div style={{ fontSize: '0.70rem', color: 'rgba(255,255,255,0.7)' }}>Your complete investment picture</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
              {Array.from({ length: 5 }).map((_, i) => <Dot key={i} active={i === slide} done={i < slide} />)}
            </div>
          </div>

          {/* Slide content — fills remaining height */}
          <div key={slide} style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease-out', overflowY: 'auto' }}>
            {panels[slide]}
          </div>
        </div>
      </div>
    </>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '14px 22px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  color: '#fff', fontWeight: 700, fontSize: '0.95rem',
  cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
}
const btnSecondary: React.CSSProperties = {
  padding: '13px 18px', borderRadius: 12, fontWeight: 600, fontSize: '0.90rem',
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
  color: '#ffffff', cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
  color: '#ffffff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 5, textShadow: '0 1px 2px rgba(0,0,0,0.2)',
}
