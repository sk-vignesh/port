'use client'
import dynamicImport from 'next/dynamic'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'

const AppGrid = dynamicImport(() => import('@/components/AppGrid'), { ssr: false })

const fmtINR = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

const fmtPct = (v: number | null) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export interface WatchlistRow {
  id: string; name: string; ticker: string | null; price: number | null; change_pct: number | null
}

const colDefs: ColDef[] = [
  { field: 'name', headerName: 'Security', flex: 1, minWidth: 160, cellStyle: { color: 'var(--color-accent-light)' } },
  { field: 'ticker', headerName: 'Symbol', width: 110, cellStyle: { color: 'var(--color-text-muted)' } },
  {
    field: 'price', headerName: 'Price', type: 'numericColumn', width: 130,
    valueFormatter: (p: ValueFormatterParams) => p.value != null ? fmtINR(p.value / 100) : '—',
  },
  {
    field: 'change_pct', headerName: '% Change', type: 'numericColumn', width: 110,
    valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
    cellStyle: (p) => ({
      color: p.value == null ? 'var(--color-text-muted)'
        : p.value > 0 ? 'var(--color-success)' : p.value < 0 ? 'var(--color-danger)'
        : 'var(--color-text-secondary)',
      fontWeight: 600,
    }),
  },
]

export default function WatchlistGrid({ rows }: { rows: WatchlistRow[] }) {
  return <AppGrid rowData={rows} columnDefs={colDefs} exportFilename="watchlist" height={380} />
}
