'use client'
import dynamicImport from 'next/dynamic'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { formatDate } from '@/lib/format'

const AppGrid = dynamicImport(() => import('@/components/AppGrid'), { ssr: false })

const fmtINR = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

export interface TxRow {
  id: string; date: string; kind: 'account' | 'portfolio'
  type: string; type_label: string; security_name: string | null
  account_portfolio: string | null; shares: number | null; amount: number
}

const KIND_COLOR: Record<string, string> = {
  account: 'var(--color-info, #60a5fa)',
  portfolio: 'var(--color-accent-light)',
}

const TYPE_COLOR = (type: string) => {
  const buy  = ['BUY','DELIVERY_INBOUND','TRANSFER_IN','DEPOSIT','DIVIDENDS','INTEREST']
  const sell = ['SELL','DELIVERY_OUTBOUND','TRANSFER_OUT','WITHDRAWAL','FEE']
  if (buy.includes(type))  return 'var(--color-success)'
  if (sell.includes(type)) return 'var(--color-danger)'
  return 'var(--color-text-secondary)'
}

const colDefs: ColDef[] = [
  {
    field: 'date', headerName: 'Date', width: 120,
    valueFormatter: (p: ValueFormatterParams) => formatDate(p.value),
    sort: 'desc',
  },
  {
    field: 'kind', headerName: 'Kind', width: 90,
    cellStyle: (p) => ({ color: KIND_COLOR[p.value] ?? 'inherit', fontWeight: 600, textTransform: 'capitalize' }),
  },
  {
    field: 'type_label', headerName: 'Type', width: 130,
    cellStyle: (p) => ({ color: TYPE_COLOR((p.data as TxRow)?.type ?? ''), fontWeight: 500 }),
  },
  { field: 'security_name', headerName: 'Security', flex: 1, minWidth: 140 },
  { field: 'account_portfolio', headerName: 'Account / Portfolio', flex: 1, minWidth: 140, cellStyle: { color: 'var(--color-text-muted)' } },
  {
    field: 'shares', headerName: 'Shares', type: 'numericColumn', width: 100,
    valueFormatter: (p: ValueFormatterParams) => p.value != null ? Math.round(p.value).toLocaleString('en-IN') : '—',
    cellStyle: { color: 'var(--color-text-muted)' },
  },
  {
    field: 'amount', headerName: 'Amount', type: 'numericColumn', width: 140,
    valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value / 100),
    cellStyle: (p) => ({ color: TYPE_COLOR((p.data as TxRow)?.type ?? '') }),
  },
]

export default function TransactionsGrid({ rows }: { rows: TxRow[] }) {
  return <AppGrid rowData={rows} columnDefs={colDefs} exportFilename="transactions" height={500} />
}
