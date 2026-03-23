'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react'

const AppGrid = dynamic(() => import('@/components/AppGrid'), { ssr: false })

// ── CSV Parsing ───────────────────────────────────────────────────────────────
interface ParsedTrade {
  symbol: string; isin: string; date: string; type: string
  qty: number; price: number; trade_id: string; exchange: string
}

function parseDate(raw: string): string {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const parts = s.split(/[-\/]/)
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (c.length === 4) return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`
    if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`
  }
  return s
}

function parseCSV(text: string): { trades: ParsedTrade[]; error: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { trades: [], error: 'File is empty.' }
  const headers = lines[0].replace(/^\uFEFF/, '').split(',')
    .map(h => h.replace(/^"|"$/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_'))

  const col = (aliases: string[]) => {
    for (const a of aliases) { const i = headers.indexOf(a); if (i !== -1) return i }
    return -1
  }
  const iSym   = col(['symbol','trading_symbol','scrip'])
  const iIsin  = col(['isin'])
  const iDate  = col(['trade_date','order_execution_time','date'])
  const iType  = col(['trade_type','transaction_type','buy_sell','type'])
  const iQty   = col(['quantity','qty'])
  const iPrice = col(['price','trade_price','average_price'])
  const iTrade = col(['trade_id','order_id','trade_no'])
  const iExch  = col(['exchange'])

  const trades: ParsedTrade[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',').map(x => x.replace(/^"|"$/g, '').trim())
    const get = (idx: number) => idx >= 0 ? (c[idx] ?? '') : ''
    const sym = get(iSym).toUpperCase()
    const qty = parseFloat(get(iQty)); const price = parseFloat(get(iPrice))
    if (!sym || isNaN(qty) || isNaN(price) || qty <= 0) continue
    trades.push({
      symbol: sym, isin: get(iIsin).toUpperCase(),
      date: parseDate(get(iDate)), type: get(iType).toLowerCase().includes('sell') ? 'sell' : 'buy',
      qty, price, trade_id: get(iTrade), exchange: get(iExch).toUpperCase() || 'NSE',
    })
  }
  return trades.length ? { trades, error: null } : { trades: [], error: 'No valid trades found. Is this a Zerodha Trade Book CSV?' }
}

const INR = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const COLS = [
  { field: 'symbol', headerName: 'Symbol', width: 120, cellRenderer: (p: {value:string}) => <b>{p.value}</b> },
  { field: 'type', headerName: 'Type', width: 75,
    cellRenderer: (p: {value:string}) => <span style={{ color: p.value==='buy'?'var(--color-success)':'var(--color-danger)', fontWeight:600, textTransform:'uppercase' }}>{p.value}</span> },
  { field: 'date', headerName: 'Date', width: 105 },
  { field: 'qty', headerName: 'Qty', width: 75, type: 'numericColumn' },
  { field: 'price', headerName: 'Price', width: 110, type: 'numericColumn', valueFormatter: (p:{value:number}) => INR(p.value) },
  { field: 'amount', headerName: 'Amount', width: 120, type: 'numericColumn',
    valueGetter: (p:{data:ParsedTrade}) => p.data.qty * p.data.price,
    valueFormatter: (p:{value:number}) => INR(p.value) },
  { field: 'exchange', headerName: 'Exch', width: 70 },
  { field: 'isin', headerName: 'ISIN', width: 140, cellStyle: { color:'var(--color-text-muted)', fontSize:'0.78rem' } },
]

interface Portfolio { id: string; name: string }

export default function ImportPage() {
  const [portfolios,  setPortfolios]  = useState<Portfolio[]>([])
  const [portfolioId, setPortfolioId] = useState('')
  const [trades,      setTrades]      = useState<ParsedTrade[]>([])
  const [parseError,  setParseError]  = useState<string | null>(null)
  const [fileName,    setFileName]    = useState<string | null>(null)
  const [importing,   setImporting]   = useState(false)
  const [result,      setResult]      = useState<{imported:number;skipped:number;new_securities:number;errors:string[]}|null>(null)
  const [dragging,    setDragging]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().from('portfolios').select('id, name').eq('is_retired', false).order('name')
      .then(({ data }) => { if (data?.length) { setPortfolios(data); setPortfolioId(data[0].id) } })
  }, [])

  const handleFile = useCallback((file: File) => {
    setFileName(file.name); setParseError(null); setTrades([]); setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const { trades: parsed, error } = parseCSV(e.target?.result as string)
      if (error) setParseError(error); else setTrades(parsed)
    }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }, [handleFile])

  const doImport = async () => {
    if (!portfolioId || trades.length === 0) return
    setImporting(true); setResult(null)
    const res  = await fetch('/api/import/zerodha', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio_id: portfolioId, trades }),
    })
    setResult(await res.json()); setImporting(false)
  }

  const reset = () => { setTrades([]); setFileName(null); setParseError(null); setResult(null) }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Import Trades</h1>
        <p className="page-subtitle">Upload a Zerodha Trade Book CSV to import your transactions</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* STEP 1 — Drop zone (only when no file loaded) */}
        {!trades.length && !result && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* How to export */}
              <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--color-text)' }}>How to export from Zerodha:</strong>{' '}
                Go to{' '}
                <a href="https://console.zerodha.com/reports/tradebook" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-light)' }}>
                  console.zerodha.com → Reports → Trade Book
                </a>
                {' '}→ select date range → Download CSV → upload below.
              </div>

              {/* Drop zone */}
              <div
                onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}
                onDragOver={e => e.preventDefault()} onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'var(--color-accent-subtle)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <Upload size={36} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>Drop Trade Book CSV here</div>
                <div className="text-sm text-muted">or click to browse</div>
              </div>

              {parseError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                  <AlertCircle size={15} /> {parseError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — Controls (portfolio + import button) then preview grid */}
        {trades.length > 0 && !result && (
          <>
            {/* ★ Import controls — always visible, ABOVE the grid */}
            <div className="card">
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <div className="text-sm text-muted" style={{ marginBottom: 6 }}>
                      <strong style={{ color: 'var(--color-text)' }}>{fileName}</strong> — {trades.length} trades ready to import
                    </div>
                    <select className="form-input" value={portfolioId} onChange={e => setPortfolioId(e.target.value)}>
                      {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={doImport} className="btn btn-primary" disabled={importing || !portfolioId}
                      style={{ minWidth: 160, gap: 8 }}>
                      {importing ? '⏳ Importing…' : `⬆ Import ${trades.length} trades`}
                    </button>
                    <button onClick={reset} className="btn btn-secondary" title="Cancel">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview grid */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header"><span className="card-title text-muted" style={{ fontSize: '0.8rem' }}>Preview</span></div>
              <div style={{ height: Math.min(trades.length * 41 + 48, 360) }}>
                <AppGrid rowData={trades} columnDefs={COLS} showSearch={false} />
              </div>
            </div>
          </>
        )}

        {/* STEP 3 — Result */}
        {result && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-success)', fontWeight: 600 }}>
                <CheckCircle size={20} /> Import complete
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Imported',           value: result.imported,       color: 'var(--color-success)' },
                  { label: 'Skipped (dupes)',     value: result.skipped,        color: 'var(--color-text-muted)' },
                  { label: 'New securities',      value: result.new_securities, color: 'var(--color-accent-light)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{result.errors.slice(0, 3).join(' • ')}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={reset} className="btn btn-secondary">Import another file</button>
                <a href="/transactions" className="btn btn-primary">View transactions →</a>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
