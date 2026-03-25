'use client'

/**
 * OnboardingModal — full-screen immersive background with bottom-right glass card.
 * Full-bleed photo covers the entire viewport.
 * Light glassmorphic card anchored to bottom-right contains branding + dialogue.
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
    width: active ? 22 : 8, height: 8, borderRadius: 4,
    background: done ? '#16a34a' : active ? '#6366f1' : 'rgba(0,0,0,0.15)',
    transition: 'all 0.3s',
  }} />
)

// Speech bubble — text reads like dialogue from the guide
const Speech = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontSize: '0.90rem', lineHeight: 1.75,
    color: '#374151', margin: '0 0 20px',
  }}>
    {children}
  </p>
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
  const [casFile, setCasFile]           = useState<File | null>(null)
  const [casPassword, setCasPassword]   = useState('')
  const [casResult, setCasResult]       = useState<{ funds: number; transactions: number } | null>(null)

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

  const bgImage =
    slide === 4                          ? '/onboarding/done.png'
    : slide === 1                        ? '/onboarding/features.png'
    : (slide === 3 && path === 'manual') ? '/onboarding/manual.png'
    : slide === 2 || slide === 3         ? '/onboarding/choose.png'
    :                                      '/onboarding/welcome.png'

  // ── Card content per slide ───────────────────────────────────────────────────
  const panels = [

    // 0 — Welcome
    <>
      <Speech>
        👋 <strong>Welcome to Apna Stocks!</strong> I&apos;m so glad you&apos;re here.
        We bring your complete investment picture together — stocks, mutual funds,
        gold, FDs, real estate — all in one place.
      </Speech>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
        {ASSET_CLASS_LIST.map(ac => (
          <div key={ac.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 20, padding: '5px 12px',
          }}>
            <span style={{ fontSize: '1rem' }}>{ac.icon}</span>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#4338ca' }}>{ac.label}</span>
          </div>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={{ ...btnPrimary, width: '100%' }}>
        Let&apos;s get started →
      </button>
    </>,

    // 1 — Features
    <>
      <Speech>
        This isn&apos;t just a spreadsheet — it&apos;s a proper investment command centre,
        built for Indian investors who want <strong>real returns</strong>, not just paper numbers.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
        {[
          { icon: '📈', title: 'True Returns (XIRR)', body: 'Accounts for when you invested each rupee' },
          { icon: '🗂', title: 'Every Asset Class', body: 'Stocks, MFs, Gold, FDs, Real Estate' },
          { icon: '🔔', title: 'Price Alerts', body: 'Buy / sell targets on your watchlist' },
          { icon: '📋', title: 'Gains & Tax', body: 'LTCG vs STCG — ready for ITR season' },
        ].map(f => (
          <div key={f.title} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(0,0,0,0.04)', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.07)', padding: '9px 12px',
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{f.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#111827' }}>{f.title}</div>
              <div style={{ fontSize: '0.70rem', color: '#6b7280' }}>{f.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setSlide(0)} style={btnSecondary}>← Back</button>
        <button onClick={() => setSlide(2)} style={{ ...btnPrimary, flex: 1 }}>Sounds great →</button>
      </div>
    </>,

    // 2 — Choose path
    <>
      <Speech>
        Alright! Let&apos;s get your investments in.
        How would you like to start? Pick whatever&apos;s easiest right now.
      </Speech>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
        {[
          { id: 'cas' as Path, icon: '📂', title: 'CAS Statement', desc: 'CAMS / KFintech PDF — auto-imports everything' },
          { id: 'csv' as Path, icon: '📤', title: 'Trade CSV', desc: 'From Kuvera, Groww, Zerodha or any broker' },
          { id: 'manual' as Path, icon: '✏️', title: 'Add Manually', desc: 'Type in your first stock — takes 30 seconds' },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setPath(opt.id); setSlide(3) }} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
            borderRadius: 12, border: '1px solid rgba(0,0,0,0.10)',
            background: 'rgba(0,0,0,0.03)', cursor: 'pointer', textAlign: 'left', color: '#111827',
          }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 2 }}>{opt.title}</div>
              <div style={{ fontSize: '0.71rem', color: '#6b7280' }}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={() => setSlide(1)} style={btnSecondary}>← Back</button>
    </>,

    // 3 — Path detail
    <>
      {path === 'manual' && (
        <>
          <Speech>
            Great! Search for the stock. I&apos;ll fetch today&apos;s price automatically —
            just tell me how many units and when you bought them.
          </Speech>
          <style>{`
            .onb-s input{background:rgba(0,0,0,0.05)!important;border:1px solid rgba(0,0,0,0.15)!important;color:#111827!important;border-radius:10px!important}
            .onb-s input::placeholder{color:#9ca3af!important}
            .onb-s [role="listbox"],.onb-s ul{background:#fff!important;border:1px solid rgba(0,0,0,0.1)!important;box-shadow:0 4px 20px rgba(0,0,0,0.1)!important}
            .onb-s [role="option"],.onb-s li{color:#111827!important}
            .onb-s [role="option"]:hover,.onb-s li:hover{background:rgba(99,102,241,0.07)!important}
          `}</style>
          <div className="onb-s" style={{ marginBottom: 10 }}>
            {picked ? (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',borderRadius:10,border:'1px solid rgba(99,102,241,0.4)',background:'rgba(99,102,241,0.07)' }}>
                <div>
                  <span style={{ fontWeight:700,fontSize:'0.85rem',color:'#111827' }}>{picked.symbol}</span>
                  {' '}<span style={{ color:'#6b7280',fontSize:'0.78rem' }}>{picked.name}</span>
                </div>
                <button onClick={() => setPicked(null)} style={{ background:'none',border:'none',color:'#9ca3af',cursor:'pointer' }}>✕</button>
              </div>
            ) : (
              <SecuritySearchInput onSelect={handleStockSelect} placeholder="Search: Reliance, TCS, HDFC…" />
            )}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10 }}>
            <div>
              <label style={labelStyle}>Units</label>
              <input type="number" placeholder="100" value={units} onChange={e=>setUnits(e.target.value)} style={inputStyle} min="0" step="any"/>
            </div>
            <div>
              <label style={labelStyle}>Price ₹{priceLoading&&<span style={{marginLeft:3,fontSize:'0.60rem',color:'#9ca3af'}}>…</span>}</label>
              <input type="number" placeholder="2350" value={price} onChange={e=>setPrice(e.target.value)}
                style={{...inputStyle,borderColor:(!priceLoading&&price)?'rgba(99,102,241,0.5)':undefined}} min="0" step="any"/>
            </div>
            <div>
              <label style={labelStyle}>Buy Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          {errMsg && <div style={{color:'#dc2626',fontSize:'0.75rem',marginBottom:8}}>{errMsg}</div>}
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
            <a href="https://www.mfcentral.com" target="_blank" rel="noreferrer" style={{color:'#6366f1'}}>mfcentral.com</a>
            {' '}or your CAMS / KFintech email. Password is usually your PAN + date of birth.
          </Speech>
          <label style={{display:'block',border:'2px dashed rgba(0,0,0,0.15)',borderRadius:12,padding:'14px',textAlign:'center',cursor:'pointer',marginBottom:10,background:'rgba(0,0,0,0.02)'}}>
            <input type="file" accept=".pdf" style={{display:'none'}} onChange={e=>setCasFile(e.target.files?.[0]??null)}/>
            <div style={{fontSize:'1.6rem',marginBottom:4}}>📄</div>
            <div style={{fontSize:'0.80rem',color:casFile?'#16a34a':'#6b7280'}}>{casFile?`✓ ${casFile.name}`:'Click to browse or drop PDF'}</div>
          </label>
          <div style={{marginBottom:10}}>
            <label style={labelStyle}>PDF Password (if protected)</label>
            <input type="password" placeholder="e.g. ABCDE1234F01011990" value={casPassword} onChange={e=>setCasPassword(e.target.value)} style={inputStyle}/>
          </div>
          {errMsg && <div style={{color:'#dc2626',fontSize:'0.75rem',marginBottom:8}}>{errMsg}</div>}
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
            I&apos;ll take you straight to the import page — it walks you through mapping
            your broker&apos;s columns. Your data will be ready in minutes.
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

    // 4 — Done
    <>
      <Speech>
        🎉 <strong>That&apos;s it — you&apos;re all set!</strong>
        {casResult && <> I imported <strong>{casResult.funds} funds</strong> and <strong>{casResult.transactions} transactions</strong> from your CAS.</>}
        {path === 'manual' && <> Your first holding is in — go explore your returns!</>}
        {' '}Your dashboard is live. Check your returns, set alerts, and dig into analytics whenever you&apos;re ready.
      </Speech>
      <button onClick={markComplete} style={{...btnPrimary,width:'100%',fontSize:'1rem',padding:'15px 24px'}}>
        Go to my Dashboard →
      </button>
    </>,
  ]

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Full-screen background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, animation: 'fadeIn 0.5s ease-out' }}>

        {/* Full-bleed background photo */}
        <img
          key={bgImage}
          src={bgImage}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            animation: 'fadeIn 0.6s ease-out',
          }}
        />

        {/* Subtle darkening vignette so card reads well */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 100%)',
        }} />

        {/* ── Glass card — bottom right ───────────────────────────── */}
        <div style={{
          position: 'absolute',
          bottom: 40, right: 40,
          width: 580,
          minHeight: 620,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)',
          padding: '28px 32px 28px',
          animation: 'slideUp 0.5s ease-out',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          color: '#111827',
        }}>
          {/* Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', flexShrink: 0,
            }}>📊</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827', letterSpacing: '-0.02em' }}>Apna Stocks</div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Your complete investment picture</div>
            </div>
            {/* Progress dots — right-aligned */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Dot key={i} active={i === slide} done={i < slide} />
              ))}
            </div>
          </div>

          {/* Slide content */}
          <div key={slide} style={{ animation: 'slideUp 0.3s ease-out' }}>
            {panels[slide]}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  color: '#fff', fontWeight: 700, fontSize: '0.88rem',
  cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
}
const btnSecondary: React.CSSProperties = {
  padding: '11px 16px', borderRadius: 12, fontWeight: 600, fontSize: '0.85rem',
  border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(0,0,0,0.04)',
  color: '#374151', cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(0,0,0,0.03)',
  color: '#111827', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.70rem', fontWeight: 600,
  color: '#6b7280', marginBottom: 4,
}
