'use client'

/**
 * OnboardingModal — fullscreen blocking modal.
 * Two-column layout: large portrait fills left panel, conversational content on right.
 * 5 slides: Welcome → Features → Choose Path → [CAS|CSV|Manual] → Done
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ASSET_CLASS_LIST } from '@/lib/assetClasses'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput, { SearchResult } from '@/components/SecuritySearchInput'

type Path   = 'cas' | 'csv' | 'manual' | null
type Status = 'idle' | 'loading' | 'done' | 'error'

const Dot = ({ active, done }: { active: boolean; done: boolean }) => (
  <div style={{
    width: active ? 20 : 8, height: 8, borderRadius: 4,
    background: done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.25)',
    transition: 'all 0.3s',
  }} />
)

// Speech bubble that makes text feel like dialogue
const Speech = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)',
    borderRadius: '4px 18px 18px 18px',
    padding: '14px 18px',
    marginBottom: 24,
    fontSize: '0.95rem',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.88)',
    position: 'relative',
  }}>
    {children}
  </div>
)

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

  const [casFile, setCasFile]         = useState<File | null>(null)
  const [casPassword, setCasPassword] = useState('')
  const [casResult, setCasResult]     = useState<{ funds: number; transactions: number } | null>(null)

  const supabase = createClient()

  const markComplete = useCallback(async () => {
    await fetch('/api/onboarding-complete', { method: 'POST' })
    onComplete()
  }, [onComplete])

  const handleStockSelect = async (r: SearchResult) => {
    setPicked(r)
    setPriceLoading(true)
    setPrice('')
    const { data } = await supabase
      .from('nse_market_data')
      .select('close_price')
      .eq('symbol', r.symbol)
      .order('date', { ascending: false })
      .limit(1)
      .single()
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
        .upsert(
          { user_id: user.id, name: picked.name, ticker_symbol: picked.symbol, currency_code: 'INR' } as never,
          { onConflict: 'ticker_symbol,user_id' }
        )
        .select('id').single()
      if (secErr) throw secErr
      const shares = Math.round(parseFloat(units) * 100_000_000)
      const amount = Math.round(parseFloat(price) * parseFloat(units) * 100)
      const { error: txErr } = await supabase.from('portfolio_transactions').insert({
        portfolio_id: portfolios[0].id, account_id: accounts[0].id,
        security_id: sec.id, type: 'BUY', currency_code: 'INR', shares, amount, date,
      } as never)
      if (txErr) throw txErr
      setStatus('done'); setSlide(4)
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  const submitCAS = async () => {
    if (!casFile) { setErrMsg('Please select a PDF file'); return }
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
      setErrMsg(e instanceof Error ? e.message : 'Import failed')
      setStatus('error')
    }
  }

  // ── Per-slide configuration ─────────────────────────────────────────────────
  // Each slide declares which portrait to show and what the person "says"
  const slideConfig = [
    { img: '/onboarding/welcome.png',  glow: 'rgba(99,102,241,0.5)' },
    { img: '/onboarding/features.png', glow: 'rgba(139,92,246,0.5)' },
    { img: '/onboarding/choose.png',   glow: 'rgba(99,102,241,0.5)' },
    {
      img: path === 'manual' ? '/onboarding/manual.png'
         : path === 'cas'    ? '/onboarding/choose.png'
         : '/onboarding/features.png',
      glow: 'rgba(99,102,241,0.5)',
    },
    { img: '/onboarding/done.png',     glow: 'rgba(34,197,94,0.5)'  },
  ]

  const cur = slideConfig[slide] ?? slideConfig[0]

  // ── Right-panel content per slide ───────────────────────────────────────────
  const content = [

    // Slide 0 — Welcome
    <>
      <Speech>
        👋 Hi! Welcome to <strong>Apna Stocks</strong>.
        I'm here to help you get your complete investment picture in one place —
        stocks, mutual funds, gold, fixed deposits, real estate — everything.
      </Speech>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {ASSET_CLASS_LIST.map(ac => (
          <div key={ac.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '7px 14px',
          }}>
            <span style={{ fontSize: '1.1rem' }}>{ac.icon}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{ac.label}</span>
          </div>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={{ ...btnPrimary, width: '100%' }}>
        Let's get started →
      </button>
    </>,

    // Slide 1 — Features
    <>
      <Speech>
        Before we set you up, let me tell you what you're getting.
        This isn't just a spreadsheet — it's a proper investment command centre,
        built for Indian investors who want to see <strong>real returns</strong>.
      </Speech>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '📈', title: 'True Returns (XIRR)', body: 'Accounts for when you invested each rupee' },
          { icon: '🗂', title: 'Every Asset Class', body: 'Stocks, MFs, Gold, FDs, Real Estate' },
          { icon: '🔔', title: 'Price Alerts', body: 'Buy / sell targets on your watchlist' },
          { icon: '📋', title: 'Gains & Tax', body: 'LTCG vs STCG — ready for ITR season' },
        ].map(f => (
          <div key={f.title} style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.10)', padding: '14px 12px',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 3 }}>{f.title}</div>
            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{f.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setSlide(0)} style={btnSecondary}>← Back</button>
        <button onClick={() => setSlide(2)} style={{ ...btnPrimary, flex: 1 }}>Sounds great →</button>
      </div>
    </>,

    // Slide 2 — Choose path
    <>
      <Speech>
        Alright! Let's get your investments in. How would you like to start?
        Pick whatever is easiest for you right now.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { id: 'cas' as Path, icon: '📂', title: 'CAS Statement (Mutual Funds)', desc: 'Upload your CAMS / KFintech PDF — I\'ll import everything automatically' },
          { id: 'csv' as Path, icon: '📤', title: 'Upload Trade CSV', desc: 'From Kuvera, Groww, Zerodha or any broker — quick and easy' },
          { id: 'manual' as Path, icon: '✏️', title: 'Add a Holding Manually', desc: 'Type in your first stock right now — takes 30 seconds, I promise' },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setPath(opt.id); setSlide(3) }} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
            borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left', color: 'white',
          }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 3 }}>{opt.title}</div>
              <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={btnSecondary}>← Back</button>
    </>,

    // Slide 3 — Path detail
    <>
      {path === 'manual' && (
        <>
          <Speech>
            Perfect! Search for the stock you hold. I'll fetch the current price automatically
            — just tell me how many units you own and when you bought them.
          </Speech>
          <style>{`
            .onb-search input { background: rgba(255,255,255,0.08) !important; border: 1px solid rgba(255,255,255,0.2) !important; color: white !important; border-radius: 10px !important; }
            .onb-search input::placeholder { color: rgba(255,255,255,0.4) !important; }
            .onb-search [role="listbox"], .onb-search [class*="results"], .onb-search ul { background: #1e2035 !important; border: 1px solid rgba(255,255,255,0.15) !important; }
            .onb-search [role="option"], .onb-search li { color: white !important; }
            .onb-search [role="option"]:hover, .onb-search li:hover { background: rgba(255,255,255,0.08) !important; }
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
                  {' '}<span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{picked.name}</span>
                  {picked.sector && (
                    <span style={{ marginLeft: 8, fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>{picked.sector}</span>
                  )}
                </div>
                <button onClick={() => setPicked(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            ) : (
              <SecuritySearchInput onSelect={handleStockSelect} placeholder="Search: Reliance, TCS, HDFC Bank…" />
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
                {priceLoading && <span style={{ marginLeft: 5, opacity: 0.5, fontSize: '0.65rem' }}>fetching…</span>}
                {!priceLoading && price && <span style={{ marginLeft: 5, opacity: 0.5, fontSize: '0.65rem' }}>current — edit if needed</span>}
              </label>
              <input type="number" placeholder="2350" value={price} onChange={e => setPrice(e.target.value)}
                style={{ ...inputStyle, borderColor: (!priceLoading && price) ? 'rgba(99,102,241,0.5)' : undefined }} min="0" step="any" />
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
          <Speech>
            Great choice. Download your CAS from{' '}
            <a href="https://www.mfcentral.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>mfcentral.com</a>
            {' '}or check your CAMS / KFintech email. If the PDF has a password, it's usually your PAN + date of birth.
          </Speech>
          <label style={{
            display: 'block', border: '2px dashed rgba(255,255,255,0.2)',
            borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14,
          }}>
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setCasFile(e.target.files?.[0] ?? null)} />
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: '0.88rem', color: casFile ? '#86efac' : 'rgba(255,255,255,0.6)' }}>
              {casFile ? `✓ ${casFile.name}` : 'Click to browse or drop PDF here'}
            </div>
          </label>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>PDF Password (if protected)</label>
            <input type="password" placeholder="e.g. ABCDE1234F01011990" value={casPassword} onChange={e => setCasPassword(e.target.value)} style={inputStyle} />
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
          <Speech>
            Sure! I'll take you straight to the import page. It'll walk you through mapping your broker's columns.
            Your data will be ready in a few minutes.
          </Speech>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
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
    </>,

    // Slide 4 — Done
    <>
      <Speech>
        🎉 That's it — you're <strong>all set!</strong>
        {casResult && <><br />I imported <strong>{casResult.funds} funds</strong> and <strong>{casResult.transactions} transactions</strong> from your CAS.</>}
        {path === 'manual' && <><br />Your first holding is in. Go explore your portfolio!</>}
        {' '}Your dashboard is live — check your returns, set alerts, and dig into the analytics whenever you're ready.
      </Speech>
      <button onClick={markComplete} style={{ ...btnPrimary, width: '100%', fontSize: '1rem', padding: '16px 24px' }}>
        Go to my Dashboard →
      </button>
    </>,
  ]

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      `}</style>

      {/* Fullscreen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #0a0d1a 0%, #151530 50%, #0a1520 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 820,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 32,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 520,
          animation: 'fadeUp 0.4s ease-out',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        }}>
          {/* ── LEFT: Large portrait ───────────────────────────────── */}
          <div style={{
            width: 320, flexShrink: 0,
            position: 'relative',
            background: `radial-gradient(circle at center bottom, ${cur.glow} 0%, rgba(10,13,26,0.8) 70%)`,
            overflow: 'hidden',
          }}>
            <img
              key={cur.img}
              src={cur.img}
              alt="Your guide"
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'top center',
                display: 'block',
                transition: 'opacity 0.4s',
              }}
            />
            {/* subtle gradient overlay at bottom so portrait bleeds into background */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
              background: 'linear-gradient(transparent, rgba(10,13,26,0.6))',
            }} />
          </div>

          {/* ── RIGHT: Dialogue + content ──────────────────────────── */}
          <div style={{
            flex: 1, padding: '36px 32px',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto', color: 'white',
          }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Dot key={i} active={i === slide} done={i < slide} />
              ))}
            </div>

            {/* Slide content */}
            <div style={{ flex: 1, animation: 'fadeUp 0.3s ease-out' }}>
              {content[slide]}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────
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
  display: 'block', fontSize: '0.74rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.5)', marginBottom: 5,
}
