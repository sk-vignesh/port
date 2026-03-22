'use client'

import { useRef, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'
import { appGridTheme } from '@/lib/agGridTheme'

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

const fmtINR = (v: number | null | undefined) =>
  v != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
    : '—'

function ChangeCellRenderer({ value }: ICellRendererParams) {
  if (value == null || value === '—') return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const num = typeof value === 'string' ? parseFloat(value) : (value as number)
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
      field: 'prev_close', headerName: 'Prev Close', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'open_price', headerName: 'Open', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'high_price', headerName: 'High', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-success)', fontWeight: 500 },
    },
    {
      field: 'low_price', headerName: 'Low', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { color: 'var(--color-danger)', fontWeight: 500 },
    },
    {
      field: 'close_price', headerName: 'Close', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      cellStyle: { fontWeight: 700 },
    },
    {
      field: 'chg', headerName: 'Change', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) =>
        p.value != null ? (p.value >= 0 ? '+' : '') + fmtINR(p.value) : '—',
      cellRenderer: ChangeCellRenderer,
    },
    {
      field: 'pct', headerName: '% Change', type: 'numericColumn',
      sort: 'desc',
      comparator: (a: number, b: number) => Math.abs(b) - Math.abs(a),
      valueFormatter: (p: ValueFormatterParams) =>
        p.value != null ? `${p.value >= 0 ? '+' : ''}${(p.value as number).toFixed(2)}%` : '—',
      cellRenderer: ChangeCellRenderer,
    },
    {
      field: 'volume', headerName: 'Volume', type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) =>
        p.value != null ? (p.value as number).toLocaleString('en-IN') : '—',
      cellStyle: { color: 'var(--color-text-muted)' },
    },
    {
      field: 'isin', headerName: 'ISIN', width: 140,
      cellStyle: { color: 'var(--color-text-muted)', fontSize: '11px' },
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

      <div style={{ height: 640, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <AgGridReact
          ref={gridRef}
          theme={appGridTheme}
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
