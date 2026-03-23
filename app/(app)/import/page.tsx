'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'

const AppGrid = dynamic(() => import('@/components/AppGrid'), { ssr: false })

// ── CSV Parsing ───────────────────────────────────────────────────────────────

interface ParsedTrade {
  symbol: string
  isin: string
  date: string
  type: string         // 'buy' | 'sell'
  qty: number
  price: number
  trade_id: string
  exchange: string
  raw_date: string
}

function parseDate(raw: string): string {
  // Handles: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const parts = s.split(/[-\/]/)
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (c.length === 4) return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}` // DD-MM-YYYY
    if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}` // YYYY-MM-DD
  }
  return s
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

function parseZerodhaCSV(text: string): { trades: ParsedTrade[]; error: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { trades: [], error: 'File is empty.' }

  // Handle BOM
  const headerLine = lines[0].replace(/^\uFEFF/, '')
  const rawHeaders = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim())
  const headers    = rawHeaders.map(normaliseHeader)

  const col = (name: string) => {
    const aliases: Record<string, string[]> = {
      symbol:    ['symbol', 'trading_symbol', 'scrip'],
      isin:      ['isin'],
      date:      ['trade_date', 'order_execution_time', 'date'],
      type:      ['trade_type', 'transaction_type', 'type', 'buy_sell'],
      qty:       ['quantity', 'qty'],
      price:     ['price', 'trade_price', 'average_price'],
      trade_id:  ['trade_id', 'order_id', 'trade_no'],
      exchange:  ['exchange'],
    }
    for (const alias of aliases[name] ?? [name]) {
      const idx = headers.indexOf(alias)
      if (idx !== -1) return idx
    }
    return -1
  }

  const trades: ParsedTrade[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const get   = (name: string) => cells[col(name)] ?? ''

    const symbol   = get('symbol').toUpperCase()
    const typeRaw  = get('type').toLowerCase()
    const qtyStr   = get('qty')
    const priceStr = get('price')
    const dateRaw  = get('date')

    if (!symbol || !typeRaw || !qtyStr || !priceStr) continue

    const qty   = parseFloat(qtyStr)
    const price = parseFloat(priceStr)
    if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) continue

    trades.push({
      symbol,
      isin:     get('isin').toUpperCase(),
      date:     parseDate(dateRaw),
      type:     typeRaw.includes('sell') ? 'sell' : 'buy',
      qty,
      price,
      trade_id: get('trade_id'),
      exchange: get('exchange').toUpperCase() || 'NSE',
      raw_date: dateRaw,
    })
  }

  if (trades.length === 0) return { trades: [], error: 'No valid trades found. Is this a Zerodha Trade Book CSV?' }
  return { trades, error: null }
}

// ── Grid column defs ──────────────────────────────────────────────────────────

const INR = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const COLUMNS = [
  { field: 'symbol',   headerName: 'Symbol',   width: 120,
    cellRenderer: (p: { value: string }) => <span style={{ fontWeight: 500 }}>{p.value}</span> },
  { field: 'type',     headerName: 'Type',     width: 80,
    cellRenderer: (p: { value: string }) => (
      <span style={{ color: p.value === 'buy' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600, textTransform: 'uppercase' }}>
        {p.value}
      </span>
    )},
  { field: 'date',     headerName: 'Date',     width: 110 },
  { field: 'qty',      headerName: 'Qty',      width: 80,  type: 'numericColumn' },
  { field: 'price',    headerName: 'Price',    width: 110, valueFormatter: (p: { value: number }) => INR(p.value), type: 'numericColumn' },
  { field: 'amount',   headerName: 'Amount',   width: 120, valueGetter:   (p: { data: ParsedTrade }) => p.data.qty * p.data.price,
    valueFormatter: (p: { value: number }) => INR(p.value), type: 'numericColumn' },
  { field: 'exchange', headerName: 'Exch',     width: 70 },
  { field: 'isin',     headerName: 'ISIN',     width: 140, cellStyle: { color: 'var(--color-text-muted)', fontSize: '0.78rem' } },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Portfolio { id: string; name: string }

export default function ImportPage() {
  const [portfolios,   setPortfolios]   = useState<Portfolio[]>([])
  const [portfolioId,  setPortfolioId]  = useState('')
  const [trades,       setTrades]       = useState<ParsedTrade[]>([])
  const [parseError,   setParseError]   = useState<string | null>(null)
  const [fileName,     setFileName]     = useState<string | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [result,       setResult]       = useState<{ imported: number; skipped: number; new_securities: number; errors: string[] } | null>(null)
  const [dragging,     setDragging]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().from('portfolios').select('id, name').eq('is_retired', false).order('name')
      .then(({ data }) => { if (data) { setPortfolios(data); if (data.length) setPortfolioId(data[0].id) } })
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a CSV file.'); return
    }
    setFileName(file.name); setParseError(null); setTrades([]); setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { trades: parsed, error } = parseZerodhaCSV(text)
      if (error) { setParseError(error); return }
      setTrades(parsed)
    }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const doImport = async () => {
    if (!portfolioId || trades.length === 0) return
    setImporting(true); setResult(null)
    try {
      const res  = await fetch('/api/import/zerodha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_id: portfolioId, trades }),
      })
      const json = await res.json()
      setResult(json)
    } finally { setImporting(false) }
  }

  const reset = () => { setTrades([]); setFileName(null); setParseError(null); setResult(null) }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Import Trades</h1>
        <p className="page-subtitle">Upload a Zerodha Trade Book CSV to import your transactions</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: trades.length ? undefined : 640 }}>

        {/* How to export guide */}
        {!trades.length && !result && (
          <div className="card">
            <div className="card-header"><span className="card-title">📖 How to export from Zerodha</span></div>
            <div className="card-body">
              <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                <li>Go to <a href="https://console.zerodha.com/reports/tradebook" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-light)' }}>console.zerodha.com/reports/tradebook</a></li>
                <li>Select the financial year / date range you want</li>
                <li>Click <strong style={{ color: 'var(--color-text)' }}>Download</strong> → CSV</li>
                <li>Upload the file below — all your trades will be previewed before import</li>
              </ol>
            </div>
          </div>
        )}

        {/* Drop zone */}
        {!trades.length && !result && (
          <div
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
              transition: 'all 0.2s',
            }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <Upload size={36} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
              Drop your Trade Book CSV here
            </div>
            <div className="text-sm text-muted">or click to browse</div>
            {parseError && (
              <div style={{ marginTop: 16, color: 'var(--color-danger)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <AlertCircle size={14} /> {parseError}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {trades.length > 0 && (
          <>
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <FileText size={15} style={{ marginRight: 6, display: 'inline' }} />
                  {fileName} — {trades.length} trades
                </span>
                <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ height: Math.min(trades.length * 41 + 50, 420), padding: '0 4px 4px' }}>
                <AppGrid rowData={trades} columnDefs={COLUMNS} />
              </div>
            </div>

            {/* Import controls */}
            {!result && (
              <div className="card">
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Import into portfolio</label>
                    <select className="form-input" value={portfolioId} onChange={e => setPortfolioId(e.target.value)} style={{ width: '100%' }}>
                      {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingBottom: 1 }}>
                    <button onClick={reset} className="btn btn-secondary">Cancel</button>
                    <button onClick={doImport} className="btn btn-primary" disabled={importing || !portfolioId}>
                      {importing ? '⏳ Importing…' : `⬆ Import ${trades.length} trades`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Result */}
        {result && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-success)' }}>
                <CheckCircle size={20} />
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>Import complete</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Imported', value: result.imported, color: 'var(--color-success)' },
                  { label: 'Skipped (duplicates)', value: result.skipped, color: 'var(--color-text-muted)' },
                  { label: 'New securities created', value: result.new_securities, color: 'var(--color-accent-light)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)', lineHeight: 1.6 }}>
                  {result.errors.slice(0, 5).join(' • ')}
                </div>
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
