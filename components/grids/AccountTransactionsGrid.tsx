'use client'
import dynamicImport from 'next/dynamic'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { formatDate } from '@/lib/format'

const AppGrid = dynamicImport(() => import('@/components/AppGrid'), { ssr: false })

const fmtINR = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

const CREDIT = new Set(['DEPOSIT','INTEREST','DIVIDENDS','FEES_REFUND','TAX_REFUND','SELL','TRANSFER_IN'])

export interface AccountTxRow {
  id: string; date: string; type: string; type_label: string
  security_name: string | null; note: string | null; amount: number
}

const colDefs: ColDef[] = [
  {
    field: 'date', headerName: 'Date', width: 120,
    valueFormatter: (p: ValueFormatterParams) => formatDate(p.value),
    sort: 'desc',
  },
  {
    field: 'type_label', headerName: 'Type', width: 150,
    cellStyle: (p) => {
      const isCredit = CREDIT.has((p.data as AccountTxRow)?.type ?? '')
      return { color: isCredit ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 500 }
    },
  },
  { field: 'security_name', headerName: 'Security', flex: 1, minWidth: 120, cellStyle: { color: 'var(--color-text-muted)' } },
  { field: 'note', headerName: 'Note', flex: 1, minWidth: 120, cellStyle: { color: 'var(--color-text-muted)' } },
  {
    field: 'amount', headerName: 'Amount', type: 'numericColumn', width: 150,
    valueFormatter: (p: ValueFormatterParams) => {
      const isCredit = CREDIT.has((p.data as AccountTxRow)?.type ?? '')
      return (isCredit ? '+' : '−') + fmtINR(p.value / 100)
    },
    cellStyle: (p) => {
      const isCredit = CREDIT.has((p.data as AccountTxRow)?.type ?? '')
      return { color: isCredit ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }
    },
  },
]

export default function AccountTransactionsGrid({ rows }: { rows: AccountTxRow[] }) {
  return <AppGrid rowData={rows} columnDefs={colDefs} exportFilename="account_transactions" height={460} />
}
