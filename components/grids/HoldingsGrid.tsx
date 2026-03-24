'use client'

import { useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import Link from 'next/link'
import { formatAmount, formatShares, formatPercent } from '@/lib/format'

export interface HoldingRow {
  securityId: string
  name: string
  currency: string
  shares: number
  avgCostPerShare: number
  costBasis: number
  currentValue: number | null
  currentPrice: number | null
  gain: number | null
  gainPct: number | null
}

export default function HoldingsGrid({ rows }: { rows: HoldingRow[] }) {
  const colDefs: ColDef<HoldingRow>[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Security',
      flex: 2,
      cellRenderer: (p: { data?: HoldingRow }) =>
        p.data ? (
          <Link href={`/securities/${p.data.securityId}`}
            style={{ fontWeight: 600, color: 'var(--color-accent-light)', textDecoration: 'none' }}>
            {p.data.name}
          </Link>
        ) : null,
    },
    {
      field: 'shares',
      headerName: 'Shares',
      type: 'rightAligned',
      flex: 1,
      valueFormatter: p => p.value != null ? formatShares(p.value) : '—',
    },
    {
      field: 'avgCostPerShare',
      headerName: 'Avg Cost / Share',
      type: 'rightAligned',
      flex: 1,
      valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
    },
    {
      field: 'costBasis',
      headerName: 'Cost Basis',
      type: 'rightAligned',
      flex: 1,
      valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
    },
    {
      field: 'currentValue',
      headerName: 'Current Value',
      type: 'rightAligned',
      flex: 1,
      valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
    },
    {
      field: 'gain',
      headerName: 'Gain / Loss',
      type: 'rightAligned',
      flex: 1,
      valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
      cellStyle: p =>
        p.value == null ? null :
        p.value >= 0 ? { color: 'var(--color-success)' } : { color: 'var(--color-danger)' },
    },
    {
      field: 'gainPct',
      headerName: 'Return %',
      type: 'rightAligned',
      flex: 1,
      valueFormatter: p => p.value != null ? formatPercent(p.value * 100) : '—',
      cellStyle: p =>
        p.value == null ? null :
        p.value >= 0 ? { color: 'var(--color-success)' } : { color: 'var(--color-danger)' },
    },
  ], [])

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressMovable: true,
    cellStyle: { fontSize: '0.82rem' },
  }), [])

  return (
    <div className="ag-theme-custom" style={{ width: '100%', height: Math.max(200, rows.length * 42 + 42) }}>
      <AgGridReact
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        suppressCellFocus
        domLayout="normal"
        rowHeight={42}
        headerHeight={36}
      />
    </div>
  )
}
