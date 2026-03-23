'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const AppGrid = dynamic(() => import('@/components/AppGrid'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedTrade {
  symbol: string; isin: string; date: string; type: string
  qty: number; price: number; trade_id: string; exchange: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(raw: string): string {
  const s = (raw ?? '').trim()
  // Excel numeric date (days since 1900-01-01)
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s))
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const parts = s.split(/[-\/]/)
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (c.length === 4) return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`
    if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`
  }
  return s
}

function normalise(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function detectType(raw: string): 'buy' | 'sell' {
  const s = raw.trim().toLowerCase()
  if (s === 's' || s.startsWith('sell')) return 'sell'
  return 'buy'
}

function detectBroker(headers: string[]): 'groww' | 'zerodha' | 'unknown' {
  if (headers.some(h => h.includes('security_name') || h.includes('scrip_name'))) return 'groww'
  if (headers.some(h => h.includes('order_execution_time'))) return 'zerodha'
  return 'unknown'
}

// Unified column aliases for Zerodha + Groww
const ALIASES: Record<string, string[]> = {
  symbol:   ['symbol', 'trading_symbol', 'scrip', 'security_name', 'scrip_name', 'instrument'],
  isin:     ['isin'],
  date:     ['trade_date', 'order_execution_time', 'date', 'trade_date_time', 'time', 'timestamp'],
  type:     ['trade_type', 'transaction_type', 'buy_sell', 'type', 'order_type', 'buysell'],
  qty:      ['quantity', 'qty', 'units', 'trade_quantity'],
  price:    ['price', 'trade_price', 'average_price', 'avg_price', 'trade_rate'],
  trade_id: ['trade_id', 'order_id', 'trade_no', 'tradeid', 'reference_number'],
  exchange: ['exchange', 'market'],
}

function findCol(headers: string[], key: string): number {
  for (const alias of ALIASES[key]) {
    const i = headers.indexOf(alias)
    if (i !== -1) return i
  }
  return -1
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, dateNF: 'YYYY-MM-DD' })
  return json as string[][]
}

function parseRows(rows: string[][]): { trades: ParsedTrade[]; broker: string; error: string | null } {
  if (rows.length < 2) return { trades: [], broker: 'unknown', error: 'File appears empty.' }

  // Find the header row (first row containing recognisable column names)
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i].map(c => normalise(String(c ?? '')))
    if (row.some(h => ['symbol','isin','quantity','trade_type','transaction_type','security_name'].includes(h))) {
      headerRowIdx = i; break
    }
  }

  const rawHeaders = rows[headerRowIdx].map(c => String(c ?? '').trim())
  const headers    = rawHeaders.map(normalise)
  const broker     = detectBroker(headers)

  const iSym   = findCol(headers, 'symbol')
  const iIsin  = findCol(headers, 'isin')
  const iDate  = findCol(headers, 'date')
  const iType  = findCol(headers, 'type')
  const iQty   = findCol(headers, 'qty')
  const iPrice = findCol(headers, 'price')
  const iTrade = findCol(headers, 'trade_id')
  const iExch  = findCol(headers, 'exchange')

  const trades: ParsedTrade[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const c   = rows[i]
    const get = (idx: number) => idx >= 0 ? String(c[idx] ?? '').trim() : ''

    const symRaw = get(iSym)
    const isin   = get(iIsin).toUpperCase()
    // For Groww, security_name is a company name — use ISIN as primary key
    // For symbol, take only the part before any space (e.g. "RELIANCE INDUSTRIES" → use ISIN)
    const sym    = (symRaw.split(' ')[0] || isin || 'UNKNOWN').toUpperCase()
    const qty    = parseFloat(get(iQty))
    const price  = parseFloat(get(iPrice).replace(/,/g, ''))
    const typeRaw= get(iType)
    const dateRaw= get(iDate)

    if (!sym || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) continue
    if (!typeRaw) continue

    trades.push({
      symbol:   sym,
      isin,
      date:     parseDate(dateRaw),
      type:     detectType(typeRaw),
      qty,
      price,
      trade_id: get(iTrade),
      exchange: get(iExch).toUpperCase() || 'NSE',
    })
  }

  if (trades.length === 0)
    return { trades: [], broker, error: 'No valid trades found. Check the file is a Trade Book export from Zerodha or Groww.' }

  return { trades, broker, error: null }
}

// ── Main file handler — supports CSV + XLSX ───────────────────────────────────
function readFile(file: File): Promise<{ trades: ParsedTrade[]; broker: string; error: string | null }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        let rows: string[][]
        if (isXlsx) {
          const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = sheetToRows(ws)
        } else {
          // CSV
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer)
          rows = text.split('\n').map(l => l.trim()).filter(Boolean)
            .map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
        }
        resolve(parseRows(rows))
      } catch (err) {
        resolve({ trades: [], broker: 'unknown', error: `Parse error: ${err instanceof Error ? err.message : err}` })
      }
    }

    if (isXlsx) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  })
}

// ── Grid columns ──────────────────────────────────────────────────────────────
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

const BROKER_BADGE: Record<string, { label: string; color: string }> = {
  zerodha: { label: '🟣 Zerodha detected', color: '#7c3aed' },
  groww:   { label: '🟢 Groww detected',   color: '#16a34a' },
  unknown: { label: '🔵 Unknown format',    color: 'var(--color-text-muted)' },
}

interface Portfolio { id: string; name: string }

export default function ImportPage() {
  const [portfolios,  setPortfolios]  = useState<Portfolio[]>([])
  const [portfolioId, setPortfolioId] = useState('')
  const [trades,      setTrades]      = useState<ParsedTrade[]>([])
  const [broker,      setBroker]      = useState('unknown')
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

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name); setParseError(null); setTrades([]); setResult(null); setBroker('unknown')
    const { trades: parsed, broker: detected, error } = await readFile(file)
    if (error) setParseError(error)
    else { setTrades(parsed); setBroker(detected) }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }, [handleFile])

  const doImport = async () => {
    if (!portfolioId || trades.length === 0) return
    setImporting(true); setResult(null)
    const res = await fetch('/api/import/zerodha', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio_id: portfolioId, trades }),
    })
    setResult(await res.json()); setImporting(false)
  }

  const reset = () => { setTrades([]); setFileName(null); setParseError(null); setResult(null); setBroker('unknown') }

  const badge = BROKER_BADGE[broker] ?? BROKER_BADGE.unknown

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Import Trades</h1>
        <p className="page-subtitle">Upload a Trade Book from Zerodha or Groww to import your transactions</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* STEP 1 — Drop zone */}
        {!trades.length && !result && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Instructions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  {
                    broker: '🟣 Zerodha',
                    steps: 'console.zerodha.com → Reports → Trade Book → Download CSV',
                    href: 'https://console.zerodha.com/reports/tradebook',
                    format: 'CSV',
                  },
                  {
                    broker: '🟢 Groww',
                    steps: 'App or website → Profile → Reports → Equity → Download XLSX',
                    href: 'https://groww.in/reports',
                    format: 'XLSX / CSV',
                  },
                ].map(b => (
                  <div key={b.broker} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '0.82rem', lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>{b.broker} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>({b.format})</span></div>
                    <a href={b.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-light)' }}>
                      {b.steps}
                    </a>
                  </div>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}
                onDragOver={e => e.preventDefault()} onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '44px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'var(--color-accent-subtle)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <Upload size={34} style={{ color: 'var(--color-text-muted)', marginBottom: 10 }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>Drop Trade Book here</div>
                <div className="text-sm text-muted">CSV or Excel (.xlsx) — or click to browse</div>
              </div>

              {parseError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                  <AlertCircle size={15} /> {parseError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — Controls above grid */}
        {trades.length > 0 && !result && (
          <>
            <div className="card">
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                        <strong>{fileName}</strong> — {trades.length} trades
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 999, background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44` }}>
                        {badge.label}
                      </span>
                    </div>
                    <select className="form-input" value={portfolioId} onChange={e => setPortfolioId(e.target.value)}>
                      {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={doImport} className="btn btn-primary" disabled={importing || !portfolioId} style={{ minWidth: 160 }}>
                      {importing ? '⏳ Importing…' : `⬆ Import ${trades.length} trades`}
                    </button>
                    <button onClick={reset} className="btn btn-secondary" title="Cancel"><X size={15} /></button>
                  </div>
                </div>
              </div>
            </div>

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
                  { label: 'Imported',        value: result.imported,       color: 'var(--color-success)' },
                  { label: 'Skipped (dupes)', value: result.skipped,        color: 'var(--color-text-muted)' },
                  { label: 'New securities',  value: result.new_securities, color: 'var(--color-accent-light)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{result.errors.slice(0,3).join(' • ')}</div>
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
