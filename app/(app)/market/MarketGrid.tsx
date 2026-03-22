'use client'

import { useRef, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])

export interface MarketRow {
  symbol:      string
  close_price: number
  prev_close:  number | null
  open_price:  number | null
  high_price:  number | null
  low_price:   number | null
  volume:      number | null
  isin:        string | null
  chg:         number | null
  pct:         number | null
}

const GRID_VARS: React.CSSProperties = {
  '--ag-background-color':               'var(--color-bg-card)',
  '--ag-odd-row-background-color':       'var(--color-bg-card)',
  '--ag-header-background-color':        'var(--color-bg-elevated)',
  '--ag-row-hover-color':                '#1e3a5f',
  '--ag-selected-row-background-color':  '#1e3a5f',
  '--ag-foreground-color':               'var(--color-text-primary)',
  '--ag-header-foreground-color':        'var(--color-text-muted)',
  '--ag-secondary-foreground-color':     'var(--color-text-muted)',
  '--ag-border-color':                   'var(--color-border)',
  '--ag-row-border-color':               'var(--color-border)',
  '--ag-cell-horizontal-border':         'none',
  '--ag-input-focus-border-color':       'var(--color-accent-light)',
  '--ag-input-border-color':             'var(--color-border)',
  '--ag-font-family':                    'Montserrat, sans-serif',
  '--ag-font-size':                      '13px',
  '--ag-cell-horizontal-padding':        '16px',
  '--ag-header-height':                  '42px',
  '--ag-row-height':                     '44px',
  '--ag-header-column-separator-display':'none',
  '--ag-header-column-resize-handle-display': 'none',
  '--ag-range-selection-border-color':   'var(--color-accent)',
} as React.CSSProperties

const fmtINR = (v: number | null | undefined) =>
  v != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
    : '—'

const fmtVol = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('en-IN') : '—'

/** Colour cell by sign */
function ChangeCellRenderer({ value }: ICellRendererParams) {
  if (value == null || value === '—') return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const num = typeof value === 'string' ? parseFloat(value) : value
  const color = num > 0 ? 'var(--color-success)' : num < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)'
  return <span style={{ color, fontWeight: 600 }}>{value}</span>
}

export default function MarketGrid({ rows }: { rows: MarketRow[] }) {
  const gridRef = useRef<AgGridReact>(null)

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true, filter: true, resizable: true, minWidth: 90,
  }), [])

  const colDefs: ColDef[] = useMemo((): ColDef[] => [
    {
      field: 'symbol',
      headerName: 'Symbol',
      pinned: 'left',
      width: 130,
      cellStyle: { fontWeight: 700, color: 'var(--color-accent-light)', letterSpacing: '0.04em' },
    },
    {
      field: 'prev_close',
      headerName: 'Prev Close',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
      type: 'numericColumn',
    },
    {
      field: 'open_price',
      headerName: 'Open',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
      type: 'numericColumn',
    },
    {
      field: 'high_price',
      headerName: 'High',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-success)', fontWeight: 500 },
      type: 'numericColumn',
    },
    {
      field: 'low_price',
      headerName: 'Low',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-danger)', fontWeight: 500 },
      type: 'numericColumn',
    },
    {
      field: 'close_price',
      headerName: 'Close',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { fontWeight: 700 },
      type: 'numericColumn',
    },
    {
      field: 'chg',
      headerName: 'Change',
      valueFormatter: (p: ValueFormatterParams) =>
        p.value != null ? (p.value >= 0 ? '+' : '') + fmtINR(p.value) : '—',
      cellRenderer: ChangeCellRenderer,
      type: 'numericColumn',
    },
    {
      field: 'pct',
      headerName: '% Change',
      sort: 'desc' as const,
      comparator: (a: number, b: number) => Math.abs(b) - Math.abs(a),
      valueFormatter: (p: ValueFormatterParams) =>
        p.value != null ? `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%` : '—',
      cellRenderer: ChangeCellRenderer,
      type: 'numericColumn',
    },
    {
      field: 'volume',
      headerName: 'Volume',
      valueFormatter: (p: ValueFormatterParams) => fmtVol(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
      type: 'numericColumn',
    },
    {
      field: 'isin',
      headerName: 'ISIN',
      width: 140,
      cellStyle: { color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: '11px' },
    },
  ], [])

  const selectionColDef: ColDef = useMemo(() => ({
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 40, minWidth: 40, maxWidth: 40,
    pinned: 'left', resizable: false, sortable: false, filter: false,
  }), [])

  const exportToExcel = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const selected = api.getSelectedRows()
    const data = selected.length > 0 ? selected : rows
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'NSE Market Data')
    XLSX.writeFile(wb, `nse_market_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [rows])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px 8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {rows.length.toLocaleString('en-IN')} securities
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

      <div
        className="ag-theme-quartz-dark"
        style={{ height: 620, width: '100%', borderRadius: 8, overflow: 'hidden', ...GRID_VARS }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={[selectionColDef, ...colDefs]}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          suppressRowClickSelection
          animateRows
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[20, 50, 100]}
          domLayout="normal"
        />
      </div>
    </div>
  )
}
