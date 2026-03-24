'use client'

import dynamicImport from 'next/dynamic'
import type { ColDef } from 'ag-grid-community'
import Link from 'next/link'
import { formatAmount, formatShares, formatPercent } from '@/lib/format'
import { appGridTheme } from '@/lib/agGridTheme'

const AppGrid = dynamicImport(() => import('@/components/AppGrid'), { ssr: false })

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

const colDefs: ColDef<HoldingRow>[] = [
  {
    field: 'name',
    headerName: 'Security',
    flex: 2,
    minWidth: 160,
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
    minWidth: 90,
    valueFormatter: p => p.value != null ? formatShares(p.value) : '—',
  },
  {
    field: 'avgCostPerShare',
    headerName: 'Avg Cost',
    type: 'rightAligned',
    flex: 1,
    minWidth: 110,
    valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
  },
  {
    field: 'costBasis',
    headerName: 'Invested',
    type: 'rightAligned',
    flex: 1,
    minWidth: 110,
    valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
  },
  {
    field: 'currentValue',
    headerName: 'Mkt Value',
    type: 'rightAligned',
    flex: 1,
    minWidth: 110,
    valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
  },
  {
    field: 'gain',
    headerName: 'Gain / Loss',
    type: 'rightAligned',
    flex: 1,
    minWidth: 110,
    valueFormatter: p => p.value != null ? formatAmount(p.value, p.data?.currency) : '—',
    cellStyle: p =>
      p.value == null ? null :
      p.value >= 0 ? { color: 'var(--color-success)', fontWeight: 600 } : { color: 'var(--color-danger)', fontWeight: 600 },
  },
  {
    field: 'gainPct',
    headerName: 'Return %',
    type: 'rightAligned',
    flex: 1,
    minWidth: 90,
    valueFormatter: p => p.value != null ? formatPercent(p.value * 100) : '—',
    cellStyle: p =>
      p.value == null ? null :
      p.value >= 0 ? { color: 'var(--color-success)', fontWeight: 600 } : { color: 'var(--color-danger)', fontWeight: 600 },
  },
]

export default function HoldingsGrid({ rows }: { rows: HoldingRow[] }) {
  return (
    <AppGrid
      rowData={rows}
      columnDefs={colDefs}
      exportFilename="holdings"
      height={Math.max(200, rows.length * 44 + 100)}
    />
  )
}

export { appGridTheme }
