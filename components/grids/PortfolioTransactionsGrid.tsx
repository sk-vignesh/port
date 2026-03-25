'use client'
import dynamicImport from 'next/dynamic'
import type { ColDef, ValueGetterParams, ValueFormatterParams, SelectionChangedEvent } from 'ag-grid-community'
import { formatDate } from '@/lib/format'

const AppGrid = dynamicImport(() => import('@/components/AppGrid'), { ssr: false })

const fmtINR = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

const BUY_TYPES = new Set(['BUY','DELIVERY_INBOUND','TRANSFER_IN'])

export interface PortfolioTxRow {
  id: string; date: string; type: string; type_label: string
  security_id: string | null; security_name: string | null; shares: number; amount: number
}

const colDefs: ColDef[] = [
  {
    field: 'date', headerName: 'Date', width: 120,
    valueFormatter: (p: ValueFormatterParams) => formatDate(p.value),
    sort: 'desc',
  },
  {
    field: 'type_label', headerName: 'Type', width: 130,
    cellStyle: (p) => {
      const isBuy = BUY_TYPES.has((p.data as PortfolioTxRow)?.type ?? '')
      return { color: isBuy ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 500 }
    },
  },
  { field: 'security_name', headerName: 'Security', flex: 1, minWidth: 140 },
  {
    field: 'shares', headerName: 'Shares', type: 'numericColumn', width: 100,
    valueFormatter: (p: ValueFormatterParams) => {
      const shares = (p.value ?? 0) / 100_000_000
      return shares > 0 ? Math.round(shares).toLocaleString('en-IN') : '—'
    },
  },
  {
    field: 'amount', headerName: 'Amount', type: 'numericColumn', width: 140,
    valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value / 100),
    cellStyle: (p) => {
      const isBuy = BUY_TYPES.has((p.data as PortfolioTxRow)?.type ?? '')
      return { color: isBuy ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }
    },
  },
  {
    colId: 'price_per_share', headerName: 'Price/Share', type: 'numericColumn', width: 130,
    valueGetter: (p: ValueGetterParams) => {
      const row = p.data as PortfolioTxRow
      const shares = (row?.shares ?? 0) / 100_000_000
      return shares > 0 ? Math.round(row.amount / shares) / 100 : null
    },
    valueFormatter: (p: ValueFormatterParams) => p.value != null ? fmtINR(p.value) : '—',
    cellStyle: { color: 'var(--color-text-muted)' },
  },
]

export default function PortfolioTransactionsGrid({
  rows,
  onSelectionChange,
}: {
  rows: PortfolioTxRow[]
  portfolioId?: string
  onSelectionChange?: (securityId: string | null, securityName: string | null) => void
}) {
  const colDefsWithLink: ColDef[] = [
    ...colDefs.slice(0, 1), // date
    ...colDefs.slice(1, 2), // type_label
    {
      field: 'security_name',
      headerName: 'Security',
      flex: 1,
      minWidth: 140,
      cellRenderer: (p: { data?: PortfolioTxRow }) =>
        p.data?.security_id ? (
          <a href={`/securities/${p.data.security_id}`}
            style={{ color: 'var(--color-accent-light)', textDecoration: 'none', fontWeight: 500 }}
            onClick={e => e.stopPropagation()}>
            {p.data.security_name ?? '—'}
          </a>
        ) : (p.data?.security_name ?? '—'),
    },
    ...colDefs.slice(3), // shares, amount, price/share
  ]

  const handleSelectionChanged = (e: SelectionChangedEvent) => {
    if (!onSelectionChange) return
    const selected = (e.api.getSelectedRows() as PortfolioTxRow[])
    if (selected.length === 0) { onSelectionChange(null, null); return }
    const secId = selected[0].security_id
    const allSame = selected.every(r => r.security_id === secId)
    if (allSame && secId) {
      onSelectionChange(secId, selected[0].security_name)
    } else {
      onSelectionChange(null, null)
    }
  }

  return (
    <AppGrid
      rowData={rows}
      columnDefs={colDefsWithLink}
      exportFilename="portfolio_transactions"
      height={460}
      onSelectionChanged={handleSelectionChanged}
    />
  )
}
