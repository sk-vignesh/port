'use client'

import { useRef, useCallback, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type {
  ColDef, IDatasource, IGetRowsParams,
  SortChangedEvent, ValueGetterParams, ValueFormatterParams,
  ICellRendererParams,
} from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'
import { appGridTheme } from '@/lib/agGridTheme'

ModuleRegistry.registerModules([AllCommunityModule])

const CACHE_BLOCK = 100  // rows fetched per request

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

export default function MarketGrid({ latestDate }: { latestDate: string }) {
  const gridRef = useRef<AgGridReact>(null)
  const searchRef    = useRef('')      // avoids stale closure in datasource
  const sortColRef   = useRef('symbol')
  const sortDirRef   = useRef<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [totalRows, setTotalRows] = useState<number | null>(null)

  // ── Datasource ────────────────────────────────────────────────────────────
  const buildUrl = useCallback((start: number, end: number) => {
    const params = new URLSearchParams({
      date:    latestDate,
      start:   String(start),
      end:     String(end),
      sortCol: sortColRef.current,
      sortDir: sortDirRef.current,
    })
    if (searchRef.current.trim()) params.set('search', searchRef.current.trim())
    return `/api/market-data?${params}`
  }, [latestDate])

  const datasource = useMemo((): IDatasource => ({
    getRows(params: IGetRowsParams) {
      const start = params.startRow
      const end   = params.endRow - 1
      fetch(buildUrl(start, end))
        .then(r => r.json())
        .then(({ rows, total }: { rows: unknown[]; total: number }) => {
          setTotalRows(total)
          params.successCallback(rows ?? [], total)
        })
        .catch(() => params.failCallback())
    },
  }), [buildUrl])

  const onGridReady = useCallback(() => {
    gridRef.current?.api.setGridOption('datasource', datasource)
  }, [datasource])

  // Re-fetch from row 0 when search or sort changes
  const refresh = useCallback(() => {
    gridRef.current?.api.setGridOption('datasource', datasource)
  }, [datasource])

  const handleSearch = useCallback((val: string) => {
    searchRef.current = val
    setSearch(val)
    refresh()
  }, [refresh])

  const onSortChanged = useCallback((e: SortChangedEvent) => {
    const cols = e.api.getColumnState().filter(c => c.sort)
    if (cols.length > 0) {
      sortColRef.current  = cols[0].colId
      sortDirRef.current  = (cols[0].sort as 'asc' | 'desc') ?? 'asc'
    } else {
      sortColRef.current = 'symbol'
      sortDirRef.current = 'asc'
    }
    refresh()
  }, [refresh])

  // ── Excel export ─────────────────────────────────────────────────────────
  const exportToExcel = useCallback(async () => {
    const url = buildUrl(0, (totalRows ?? 2500))
    const { rows } = await fetch(url).then(r => r.json())
    const ws = XLSX.utils.json_to_sheet(rows ?? [])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'NSE Market Data')
    XLSX.writeFile(wb, `nse_market_${latestDate}.xlsx`)
  }, [buildUrl, latestDate, totalRows])

  // ── Column definitions ────────────────────────────────────────────────────
  const colDefs: ColDef[] = useMemo((): ColDef[] => [
    {
      field: 'symbol', headerName: 'Symbol', pinned: 'left', width: 110,
      cellStyle: { color: 'var(--color-accent-light)' },
    },
    {
      field: 'name', headerName: 'Company', width: 260, minWidth: 180,
      cellStyle: { color: 'var(--color-text-secondary)' },
    },
    {
      field: 'prev_close', headerName: 'Prev Close', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'open_price', headerName: 'Open', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'high_price', headerName: 'High', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-success)' },
    },
    {
      field: 'low_price', headerName: 'Low', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-danger)' },
    },
    {
      field: 'close_price', headerName: 'Close', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
    },
    {
      colId: 'chg', headerName: 'Change', type: 'numericColumn', width: 130, sortable: false,
      valueGetter: (p: ValueGetterParams) => {
        if (!p.data) return null
        const { close_price, prev_close } = p.data as { close_price: number; prev_close: number }
        return close_price != null && prev_close != null ? close_price - prev_close : null
      },
      valueFormatter: (p: ValueFormatterParams) => p.value != null ? (p.value >= 0 ? '+' : '') + fmtINR(p.value) : '—',
      cellRenderer: ChangeAmtRenderer,
    },
    {
      colId: 'pct', headerName: '% Change', type: 'numericColumn', width: 110, sortable: false,
      valueGetter: (p: ValueGetterParams) => {
        if (!p.data) return null
        const { close_price, prev_close } = p.data as { close_price: number; prev_close: number }
        if (!close_price || !prev_close) return null
        return ((close_price - prev_close) / prev_close) * 100
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
    headerCheckboxSelection: false,  // no select-all in infinite mode
    width: 40, minWidth: 40, maxWidth: 40,
    pinned: 'left', resizable: false, sortable: false,
  }), [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px 10px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)', fontSize: 14, pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search symbol…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ paddingLeft: 32, fontSize: '0.82rem', height: 34 }}
          />
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {totalRows != null ? `${totalRows.toLocaleString('en-IN')} securities` : '…'}
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

      {/* Grid */}
      <div style={{ height: 640, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <AgGridReact
          ref={gridRef}
          theme={appGridTheme}
          rowModelType="infinite"
          datasource={datasource}
          cacheBlockSize={CACHE_BLOCK}
          infiniteInitialRowCount={CACHE_BLOCK}
          maxConcurrentDatasourceRequests={1}
          columnDefs={[selectionColDef, ...colDefs]}
          defaultColDef={{ sortable: true, resizable: true, minWidth: 90 }}
          rowSelection="multiple"
          suppressRowClickSelection
          animateRows
          onGridReady={onGridReady}
          onSortChanged={onSortChanged}
          domLayout="normal"
        />
      </div>

      <div style={{
        padding: '8px 2px', fontSize: '0.72rem', color: 'var(--color-text-muted)',
        display: 'flex', gap: 8, alignItems: 'center', marginTop: 6,
      }}>
        <span>📡</span>
        <span>NSE EQ bhav copy · loads {CACHE_BLOCK} rows at a time as you scroll</span>
      </div>
    </div>
  )
}
