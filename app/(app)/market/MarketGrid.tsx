'use client'

import { useRef, useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { AgGridReact } from 'ag-grid-react'
import { createClient } from '@/lib/supabase/client'
import type {
  ColDef, ValueGetterParams, ValueFormatterParams,
  ICellRendererParams, PaginationChangedEvent,
} from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'
import { appGridTheme } from '@/lib/agGridTheme'

ModuleRegistry.registerModules([AllCommunityModule])

const CHUNK      = 500   // rows fetched per network request
const PAGE_SIZE  = 100   // rows per grid page

export interface MarketRow {
  symbol:     string
  name:       string | null
  close:      number
  prev_close: number | null
  open:       number | null
  high:       number | null
  low:        number | null
  volume:     number | null
}

const fmtINR = (v: number | null | undefined) =>
  v != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
    : '—'

function ChangeCellRenderer({ value }: ICellRendererParams) {
  if (value == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const num = value as number
  const color = num > 0 ? 'var(--color-success)' : num < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)'
  return <span style={{ color, fontWeight: 600 }}>{num > 0 ? '+' : ''}{num.toFixed(2)}%</span>
}

function ChangeAmtRenderer({ value }: ICellRendererParams) {
  if (value == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const num = value as number
  const color = num > 0 ? 'var(--color-success)' : num < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)'
  return <span style={{ color, fontWeight: 600 }}>{num >= 0 ? '+' : ''}{fmtINR(num)}</span>
}

export default function MarketGrid({
  initialRows,
  latestDate,
  initialTotal,
}: {
  initialRows: MarketRow[]
  latestDate: string
  initialTotal: number
}) {
  const gridRef = useRef<AgGridReact>(null)
  const [rows, setRows]         = useState<MarketRow[]>(initialRows)
  const [offset, setOffset]     = useState(initialRows.length)
  const [loading, setLoading]   = useState(false)
  const [hasMore, setHasMore]   = useState(initialRows.length < initialTotal)
  const [search, setSearch]     = useState('')

  // ── Fetch next chunk — direct Supabase query (no /api/market-data route needed) ─
  const fetchNext = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const supabase = createClient()
      const start = offset
      const end   = offset + CHUNK - 1
      const { data: next, count } = await supabase
        .from('price_history')
        .select('symbol, name, close, prev_close, open, high, low, volume', { count: 'exact' })
        .eq('date', latestDate)
        .order('index_priority', { ascending: true, nullsFirst: false })
        .order('symbol', { ascending: true })
        .range(start, end)

      const fetched = next ?? []
      setRows(prev => [...prev, ...fetched])
      setOffset(prev => prev + fetched.length)
      if (count !== null && offset + fetched.length >= count) setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, offset, latestDate])

  // Trigger fetch when user reaches the last page of currently loaded rows
  const onPaginationChanged = useCallback((e: PaginationChangedEvent) => {
    const api = e.api
    const currentPage = api.paginationGetCurrentPage()        // 0-indexed
    const totalPages  = api.paginationGetTotalPages()
    if (hasMore && !loading && currentPage >= totalPages - 1) {
      fetchNext()
    }
  }, [hasMore, loading, fetchNext])

  const handleSearch = useCallback((val: string) => {
    setSearch(val)
    gridRef.current?.api.setGridOption('quickFilterText', val)
  }, [])

  const exportToExcel = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const selected = api.getSelectedRows()
    const data = selected.length > 0 ? selected : rows
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'NSE Market Data')
    XLSX.writeFile(wb, `nse_market_${latestDate}.xlsx`)
  }, [rows, latestDate])

  // ── Column definitions ────────────────────────────────────────────────────
  const colDefs: ColDef[] = useMemo((): ColDef[] => [
    {
      field: 'symbol', headerName: 'Symbol', pinned: 'left', width: 110,
      cellRenderer: (p: ICellRendererParams) => (
        <Link
          href={`/securities?q=${encodeURIComponent(p.value as string)}`}
          style={{ color: 'var(--color-accent-light)', textDecoration: 'none', fontWeight: 600 }}
          prefetch={false}
        >
          {p.value as string}
        </Link>
      ),
    },
    {
      field: 'name', headerName: 'Company', width: 240, minWidth: 160,
      cellStyle: { color: 'var(--color-text-secondary)' },
    },
    {
      field: 'prev_close', headerName: 'Prev Close', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'open', headerName: 'Open', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'high', headerName: 'High', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-success)' },
    },
    {
      field: 'low', headerName: 'Low', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-danger)' },
    },
    {
      field: 'close', headerName: 'Close', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
    },
    {
      colId: 'chg', headerName: 'Change', type: 'numericColumn', width: 130, sortable: false,
      valueGetter: (p: ValueGetterParams) => {
        const r = p.data as MarketRow
        return r?.close != null && r?.prev_close != null ? r.close - r.prev_close : null
      },
      valueFormatter: (p: ValueFormatterParams) => p.value != null ? (p.value >= 0 ? '+' : '') + fmtINR(p.value) : '—',
      cellRenderer: ChangeAmtRenderer,
    },
    {
      colId: 'pct', headerName: '% Change', type: 'numericColumn', width: 110, sortable: false,
      valueGetter: (p: ValueGetterParams) => {
        const r = p.data as MarketRow
        if (!r?.close || !r?.prev_close) return null
        return ((r.close - r.prev_close) / r.prev_close) * 100
      },
      cellRenderer: ChangeCellRenderer,
    },
    {
      field: 'volume', headerName: 'Volume', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) =>
        p.value != null ? (p.value as number).toLocaleString('en-IN') : '—',
      cellStyle: { color: 'var(--color-text-muted)' },
    },
  ], [])

  const selectionColDef: ColDef = useMemo(() => ({
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 40, minWidth: 40, maxWidth: 40,
    pinned: 'left', resizable: false, sortable: false, filter: false,
  }), [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px 10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search symbol or company…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ paddingLeft: 32, fontSize: '0.82rem', height: 34 }}
          />
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {rows.length.toLocaleString('en-IN')} of {initialTotal.toLocaleString('en-IN')} loaded
          {loading && ' · fetching…'}
        </span>
        <div style={{ flex: 1 }} />

        <button onClick={exportToExcel} style={{
          padding: '5px 16px', borderRadius: 6,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)',
          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'Montserrat, sans-serif',
        }}>
          ↓ Export Excel
        </button>
      </div>

      <div style={{ height: 640, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <AgGridReact
          ref={gridRef}
          theme={appGridTheme}
          rowData={rows}
          columnDefs={[selectionColDef, ...colDefs]}
          defaultColDef={{ sortable: true, resizable: true, minWidth: 90, filter: true }}
          rowSelection="multiple"
          suppressRowClickSelection
          animateRows
          pagination
          paginationPageSize={PAGE_SIZE}
          paginationPageSizeSelector={[20, 50, 100]}
          onPaginationChanged={onPaginationChanged}
          domLayout="normal"
        />
      </div>
    </div>
  )
}
