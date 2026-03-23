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

function detectBroker(headers: string[]): string {
  const h = headers
  if (h.some(x => x.includes('order_execution_time'))) return 'zerodha'
  if (h.some(x => x.includes('security_name') || x.includes('scrip_name'))) return 'groww'
  if (h.some(x => x.includes('scrip_symbol') || x.includes('net_qty') || x.includes('net_rate'))) return 'angelone'
  if (h.some(x => x.includes('instrument_key'))) return 'upstox'
  if (h.some(x => x.includes('script_code') || x.includes('order_reference'))) return 'icici'
  if (h.some(x => x.includes('security_id') || x.includes('fill_timestamp') || x.includes('underlying_symbol'))) return 'hdfc'
  if (h.some(x => x.includes('exchange_trade_id') || x.includes('dhan'))) return 'dhan'
  if (h.some(x => x.includes('order_rate') || x.includes('buysell'))) return '5paisa'
  if (h.some(x => x.includes('client_id') && !x.includes('trade'))) return 'sbicap'
  // Kotak Neo exports: symbol + order_no + rate (no price column)
  if (h.includes('rate') && h.includes('order_no') && !h.includes('fill_timestamp')) return 'kotak'
  return 'unknown'
}

// Unified column aliases — 10 Indian brokers
const ALIASES: Record<string, string[]> = {
  symbol:   ['symbol', 'trading_symbol', 'scrip', 'security_name', 'scrip_name', 'instrument',
             'scrip_symbol', 'stock_symbol', 'tradingsymbol', 'script_name',
             /* ICICI */ 'script_code', 'stock_code',
             /* HDFC  */ 'underlying_symbol', 'security_id', 'company_name'],
  isin:     ['isin', 'isin_code'],
  date:     ['trade_date', 'order_execution_time', 'date', 'trade_date_time', 'time', 'timestamp',
             'order_date', 'transaction_date', 'trade_time',
             /* HDFC  */ 'fill_timestamp',
             /* ICICI */ 'settlement_date'],
  type:     ['trade_type', 'transaction_type', 'buy_sell', 'type', 'order_type', 'buysell',
             'side', 'trade_side', 'action', 'b_s', 'buy___sell',
             /* 5paisa */ 'buy_sell_indicator'],
  qty:      ['quantity', 'qty', 'units', 'trade_quantity', 'net_qty', 'filled_quantity', 'executed_quantity',
             /* HDFC  */ 'traded_quantity'],
  price:    ['price', 'trade_price', 'average_price', 'avg_price', 'trade_rate', 'net_rate',
             'avg__price', 'executed_price', 'fill_price',
             /* Kotak */ 'rate',
             /* 5paisa*/ 'order_rate',
             /* HDFC  */ 'avg_price'],
  trade_id: ['trade_id', 'order_id', 'trade_no', 'tradeid', 'reference_number',
             'order_no', 'orderid', 'trade_number',
             /* ICICI */ 'order_reference', 'order_reference_no',
             /* HDFC  */ 'client_id',
             /* Dhan  */ 'exchange_trade_id', 'exchange_order_id',
             /* 5paisa*/ 'exchange_order_id_nse_bse'],
  exchange: ['exchange', 'market', 'exch', 'exchange_segment', 'exchange_code'],
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
  zerodha:  { label: 'Zerodha',    color: '#7c3aed' },
  groww:    { label: 'Groww',      color: '#16a34a' },
  angelone: { label: 'Angel One',  color: '#ea580c' },
  upstox:   { label: 'Upstox',    color: '#2563eb' },
  icici:    { label: 'ICICI Direct', color: '#ca8a04' },
  hdfc:     { label: 'HDFC Sec',  color: '#dc2626' },
  kotak:    { label: 'Kotak Neo', color: '#6b7280' },
  sbicap:   { label: 'SBICap',    color: '#4f46e5' },
  dhan:     { label: 'Dhan',      color: '#059669' },
  '5paisa': { label: '5paisa',    color: '#0284c7' },
  unknown:  { label: 'Unknown',   color: 'var(--color-text-muted)' },
}

// Single source of truth for broker export instructions
interface BrokerGuide {
  id: string; name: string; format: string; color: string
  steps: string[]; href: string
}
const BROKER_GUIDES: BrokerGuide[] = [
  { id: 'zerodha',  name: 'Zerodha',     format: 'CSV',      color: '#7c3aed',
    href: 'https://console.zerodha.com/reports/tradebook',
    steps: ['Go to console.zerodha.com', 'Click Reports → Trade Book', 'Select the date range (full financial year)', 'Click Download CSV'] },
  { id: 'groww',    name: 'Groww',       format: 'XLSX/CSV', color: '#16a34a',
    href: 'https://groww.in/reports',
    steps: ['Open groww.in and sign in', 'Go to Profile → Reports → Equity', 'Select the financial year', 'Click Download — choose XLSX or CSV'] },
  { id: 'angelone', name: 'Angel One',   format: 'XLSX/CSV', color: '#ea580c',
    href: 'https://www.angelone.in/trade/orders/tradebook',
    steps: ['Login to angelone.in', 'Go to Reports → Transactional Reports', 'Select Trade Book and the date range', 'Click the Excel/Download icon'] },
  { id: 'upstox',   name: 'Upstox',     format: 'CSV/XLSX', color: '#2563eb',
    href: 'https://account.upstox.com/reports',
    steps: ['Login to account.upstox.com', 'Go to Reports → Trade History', 'Select Financial Year from the dropdown', 'Click Download CSV or Excel'] },
  { id: 'icici',    name: 'ICICI Direct', format: 'XLSX/CSV', color: '#ca8a04',
    href: 'https://www.icicidirect.com',
    steps: ['Login to icicidirect.com', 'Go to Portfolio → Equity → Trade Book', 'Select the financial year / date range', 'Click Download (Excel or CSV)'] },
  { id: 'hdfc',     name: 'HDFC Sec',   format: 'XLSX',     color: '#dc2626',
    href: 'https://www.hdfcsec.com',
    steps: ['Login to hdfcsec.com', 'Go to My Account → Trade Details', 'Set the date range and segment (Equity)', 'Click Export to Excel'] },
  { id: 'kotak',    name: 'Kotak Neo',  format: 'CSV',      color: '#6b7280',
    href: 'https://www.kotaksecurities.com',
    steps: ['Login to Kotak Neo (neo.kotak.com)', 'Open the Orders tab', 'Switch to Trades / Trade History', 'Click Download CSV'] },
  { id: 'sbicap',   name: 'SBICap Sec', format: 'XLSX/CSV', color: '#4f46e5',
    href: 'https://www.sbicapsec.com',
    steps: ['Login to sbicapsec.com', 'Go to Reports → Trade Book', 'Select date range and Equity segment', 'Click Export / Download'] },
  { id: 'dhan',     name: 'Dhan',       format: 'CSV',      color: '#059669',
    href: 'https://dhan.co',
    steps: ['Login to dhan.co', 'Go to Reports → Trade History', 'Select the financial year', 'Click Download CSV'] },
  { id: '5paisa',   name: '5paisa',     format: 'CSV',      color: '#0284c7',
    href: 'https://www.5paisa.com',
    steps: ['Login to 5paisa.com', 'Go to My Account → Reports → Trade Book', 'Choose date range and Equity', 'Click Download'] },
]

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
  const [selectedGuideId, setSelectedGuideId] = useState<string>('')
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
        <p className="page-subtitle">Upload a Trade Book from any major Indian broker — 10 brokers supported</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* STEP 1 — Drop zone */}
        {!trades.length && !result && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Broker selector dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Your broker</label>
                  <select
                    className="form-input"
                    value={selectedGuideId}
                    onChange={e => setSelectedGuideId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">— Select to see export steps —</option>
                    {BROKER_GUIDES.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.format})</option>
                    ))}
                  </select>
                </div>

                {/* Dynamic instruction panel */}
                {selectedGuideId && (() => {
                  const guide = BROKER_GUIDES.find(g => g.id === selectedGuideId)!
                  return (
                    <div style={{
                      background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
                      padding: '14px 16px', borderLeft: `3px solid ${guide.color}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: guide.color }}>{guide.name}</span>
                        <a href={guide.href} target="_blank" rel="noopener noreferrer"
                           style={{ fontSize: '0.75rem', color: 'var(--color-accent-light)' }}>
                          Open {guide.name} ↗
                        </a>
                      </div>
                      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {guide.steps.map((step, i) => (
                          <li key={i} style={{ fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{step}</li>
                        ))}
                      </ol>
                      <div style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                        File format: <strong>{guide.format}</strong>
                      </div>
                    </div>
                  )
                })()}
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
