'use client'

/**
 * OnboardingModal — full-screen immersive layout.
 * Left 75%: full-bleed nature portrait photo.
 * Right 25%: glass panel with speech-bubble dialogue + form content.
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
    width: active ? 24 : 8, height: 8, borderRadius: 4,
    background: done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.3)',
    transition: 'all 0.3s',
  }} />
)

// Chat-bubble speech component — makes text feel like dialogue
const Speech = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px 16px 16px 16px',
    padding: '14px 16px',
    marginBottom: 20,
    fontSize: '0.88rem',
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.92)',
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
        amount: Math.round(parseFloat(price) * parseFloat(units) * 100),
        date,
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

  // ── Per-slide background image ───────────────────────────────────────────────
  const bgImage =
    slide === 4                               ? '/onboarding/done.png'
    : slide === 1                             ? '/onboarding/features.png'
    : (slide === 3 && path === 'manual')      ? '/onboarding/manual.png'
    : (slide === 3 && path !== 'manual')      ? '/onboarding/choose.png'
    : slide === 2                             ? '/onboarding/choose.png'
    :                                           '/onboarding/welcome.png'

  // ── Right-panel content ──────────────────────────────────────────────────────
  const panels = [

    // Slide 0 — Welcome
    <>
      <Speech>
        👋 <strong>Hi! Welcome to Apna Stocks.</strong>
        <br /><br />
        I'm here to help you get your complete investment picture in one place —
        stocks, mutual funds, gold, FDs, real estate — everything, together.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {ASSET_CLASS_LIST.map(ac => (
          <div key={ac.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
          }}>
            <span style={{ fontSize: '1.1rem' }}>{ac.icon}</span>
            <span style={{ fontSize: '0.80rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{ac.label}</span>
          </div>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={{ ...btnPrimary, width: '100%' }}>
        Let&apos;s get started →
      </button>
    </>,

    // Slide 1 — Features
    <>
      <Speech>
        Before we set you up, let me show you what you&apos;re getting.
        This is a proper investment command centre — built for Indian investors
        who want to see <strong>real returns</strong>, not just paper gains.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
        {[
          { icon: '📈', title: 'True Returns (XIRR)', body: 'Accounts for when you invested each rupee' },
          { icon: '🗂', title: 'Every Asset Class', body: 'Stocks, MFs, Gold, FDs, Real Estate' },
          { icon: '🔔', title: 'Price Alerts', body: 'Buy / sell targets on your watchlist' },
          { icon: '📋', title: 'Gains & Tax', body: 'LTCG vs STCG — ready for ITR season' },
        ].map(f => (
          <div key={f.title} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.07)', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.10)', padding: '10px 12px',
          }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{f.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.80rem' }}>{f.title}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>{f.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setSlide(0)} style={btnSecondary}>← Back</button>
        <button onClick={() => setSlide(2)} style={{ ...btnPrimary, flex: 1 }}>Sounds great →</button>
      </div>
    </>,

    // Slide 2 — Choose path
    <>
      <Speech>
        Alright! Let&apos;s get your investments in.
        How would you like to start? Pick whatever is easiest right now.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'cas' as Path, icon: '📂', title: 'CAS Statement', desc: 'CAMS / KFintech PDF — auto-imports everything' },
          { id: 'csv' as Path, icon: '📤', title: 'Trade CSV', desc: 'From Kuvera, Groww, Zerodha or any broker' },
          { id: 'manual' as Path, icon: '✏️', title: 'Add Manually', desc: 'Type in your first stock — 30 seconds' },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setPath(opt.id); setSlide(3) }} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.07)', cursor: 'pointer', textAlign: 'left', color: 'white',
          }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>{opt.title}</div>
              <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.55)' }}>{opt.desc}</div>
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
            Great! Search for the stock you own. I&apos;ll fetch today&apos;s price automatically —
            just tell me how many units and when you bought them.
          </Speech>
          <style>{`
            .onb-search input{background:rgba(255,255,255,0.08)!important;border:1px solid rgba(255,255,255,0.2)!important;color:white!important;border-radius:10px!important}
            .onb-search input::placeholder{color:rgba(255,255,255,0.4)!important}
            .onb-search [role="listbox"],.onb-search [class*="results"],.onb-search ul{background:#1e2035!important;border:1px solid rgba(255,255,255,0.15)!important}
            .onb-search [role="option"],.onb-search li{color:white!important}
            .onb-search [role="option"]:hover,.onb-search li:hover{background:rgba(255,255,255,0.08)!important}
          `}</style>
          <div className="onb-search" style={{ marginBottom: 12 }}>
            {picked ? (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderRadius:10,border:'1px solid rgba(99,102,241,0.5)',background:'rgba(99,102,241,0.12)' }}>
                <div>
                  <span style={{ fontWeight:700,fontSize:'0.88rem' }}>{picked.symbol}</span>
                  {' '}<span style={{ color:'rgba(255,255,255,0.6)',fontSize:'0.78rem' }}>{picked.name}</span>
                </div>
                <button onClick={() => setPicked(null)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer' }}>✕</button>
              </div>
            ) : (
              <SecuritySearchInput onSelect={handleStockSelect} placeholder="Search: Reliance, TCS, HDFC…" />
            )}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12 }}>
            <div>
              <label style={labelStyle}>Units</label>
              <input type="number" placeholder="100" value={units} onChange={e=>setUnits(e.target.value)} style={inputStyle} min="0" step="any"/>
            </div>
            <div>
              <label style={labelStyle}>Price ₹{priceLoading && <span style={{marginLeft:4,opacity:0.5,fontSize:'0.62rem'}}>fetching…</span>}</label>
              <input type="number" placeholder="2350" value={price} onChange={e=>setPrice(e.target.value)}
                style={{...inputStyle,borderColor:(!priceLoading&&price)?'rgba(99,102,241,0.5)':undefined}} min="0" step="any"/>
            </div>
            <div>
              <label style={labelStyle}>Buy Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          {errMsg && <div style={{color:'#f87171',fontSize:'0.78rem',marginBottom:10}}>{errMsg}</div>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setSlide(2)} style={btnSecondary}>← Back</button>
            <button onClick={submitManual} disabled={status==='loading'} style={{...btnPrimary,flex:1,opacity:status==='loading'?0.7:1}}>
              {status==='loading'?'⏳ Adding…':'Add & Continue →'}
            </button>
          </div>
        </>
      )}

      {path === 'cas' && (
        <>
          <Speech>
            Download your CAS from{' '}
            <a href="https://www.mfcentral.com" target="_blank" rel="noreferrer" style={{color:'#818cf8'}}>mfcentral.com</a>
            {' '}or check your CAMS / KFintech email. Password is usually your PAN + date of birth.
          </Speech>
          <label style={{display:'block',border:'2px dashed rgba(255,255,255,0.2)',borderRadius:12,padding:'16px',textAlign:'center',cursor:'pointer',marginBottom:12}}>
            <input type="file" accept=".pdf" style={{display:'none'}} onChange={e=>setCasFile(e.target.files?.[0]??null)}/>
            <div style={{fontSize:'1.8rem',marginBottom:6}}>📄</div>
            <div style={{fontSize:'0.82rem',color:casFile?'#86efac':'rgba(255,255,255,0.6)'}}>
              {casFile?`✓ ${casFile.name}`:'Click to browse or drop PDF'}
            </div>
          </label>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>PDF Password (if protected)</label>
            <input type="password" placeholder="e.g. ABCDE1234F01011990" value={casPassword} onChange={e=>setCasPassword(e.target.value)} style={inputStyle}/>
          </div>
          {errMsg && <div style={{color:'#f87171',fontSize:'0.78rem',marginBottom:10}}>{errMsg}</div>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setSlide(2)} style={btnSecondary}>← Back</button>
            <button onClick={submitCAS} disabled={status==='loading'||!casFile} style={{...btnPrimary,flex:1,opacity:(status==='loading'||!casFile)?0.6:1}}>
              {status==='loading'?'⏳ Importing…':'Upload & Import →'}
            </button>
          </div>
        </>
      )}

      {path === 'csv' && (
        <>
          <Speech>
            I&apos;ll mark your setup complete and take you straight to the import page.
            It walks you through mapping your broker&apos;s columns — your data will be ready in minutes.
          </Speech>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <button onClick={()=>setSlide(2)} style={btnSecondary}>← Back</button>
            <button onClick={async()=>{await markComplete();router.push('/import')}} style={{...btnPrimary,flex:1}}>
              Go to Import →
            </button>
          </div>
          <button onClick={markComplete} style={{...btnSecondary,width:'100%',textAlign:'center'}}>
            Skip — I&apos;ll do this later
          </button>
        </>
      )}
    </>,

    // Slide 4 — Done
    <>
      <Speech>
        🎉 <strong>That&apos;s it — you&apos;re all set!</strong>
        {casResult && <><br />I imported <strong>{casResult.funds} funds</strong> and <strong>{casResult.transactions} transactions</strong>.</>}
        {path === 'manual' && <><br />Your first holding is in. Now go explore your returns!</>}
        {' '}Your dashboard is live. Check your returns, set alerts, and dig into the analytics whenever you&apos;re ready.
      </Speech>
      <button onClick={markComplete} style={{...btnPrimary,width:'100%',fontSize:'1rem',padding:'16px 24px'}}>
        Go to my Dashboard →
      </button>
    </>,
  ]

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* Full-screen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', animation: 'fadeIn 0.5s ease-out',
      }}>
        {/* ── LEFT 75%: Full-bleed nature photo ───────────────────── */}
        <div style={{ flex: 3, position: 'relative', overflow: 'hidden' }}>
          <img
            key={bgImage}
            src={bgImage}
            alt=""
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center top',
              display: 'block',
              animation: 'fadeIn 0.6s ease-out',
            }}
          />
          {/* Gradient to help right panel blend */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 120,
            background: 'linear-gradient(to right, transparent, rgba(10,13,26,0.85))',
          }} />
          {/* Branding overlay bottom-left */}
          <div style={{
            position: 'absolute', bottom: 32, left: 36,
            color: 'rgba(255,255,255,0.9)',
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Apna Stocks</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Your complete investment picture</div>
          </div>
        </div>

        {/* ── RIGHT 25%: Glass panel ───────────────────────────────── */}
        <div style={{
          flex: 1, minWidth: 340,
          background: 'rgba(8,10,28,0.88)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          padding: '36px 28px',
          overflowY: 'auto', color: 'white',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Dot key={i} active={i === slide} done={i < slide} />
            ))}
          </div>

          {/* Slide content */}
          <div style={{ flex: 1, animation: 'slideIn 0.35s ease-out' }} key={slide}>
            {panels[slide]}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  padding: '13px 20px', borderRadius: 12, border: 'none',
  background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.90rem',
  cursor: 'pointer', transition: 'opacity 0.15s',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}
const btnSecondary: React.CSSProperties = {
  padding: '12px 16px', borderRadius: 12, fontWeight: 600, fontSize: '0.85rem',
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
  color: 'white', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.5)', marginBottom: 5,
}
