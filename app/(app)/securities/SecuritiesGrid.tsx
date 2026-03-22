'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { ColDef } from 'ag-grid-community'

const AppGrid = dynamic(() => import('@/components/AppGrid'), { ssr: false })

interface SecurityRow {
  id: string; name: string; ticker: string; isin: string; currency: string
  price: number | null; priceDate: string; change1d: number | null; status: string; updated: string
}

interface Props { rows: SecurityRow[] }

export default function SecuritiesGrid({ rows }: Props) {
  const router = useRouter()

  const fmtINR = (v: number | null) =>
    v === null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)

  const colDefs: ColDef<SecurityRow>[] = [
    {
      field: 'name', headerName: 'Name', flex: 2, minWidth: 160,
      cellRenderer: (p: { value: string; data: SecurityRow }) =>
        `<a style="color:var(--color-accent-light);font-weight:600;text-decoration:none;cursor:pointer" data-id="${p.data.id}">${p.value}</a>`,
    },
    { field: 'ticker',   headerName: 'Ticker',   width: 100, cellStyle: { fontFamily: 'monospace' } },
    { field: 'isin',     headerName: 'ISIN',      width: 140, cellStyle: { fontFamily: 'monospace', color: '#94a3b8' } },
    { field: 'currency', headerName: 'Currency',  width: 90 },
    {
      field: 'price', headerName: 'Price (₹)', width: 120, type: 'numericColumn',
      valueFormatter: p => fmtINR(p.value),
    },
    {
      field: 'change1d', headerName: 'Today', width: 90, type: 'numericColumn',
      valueFormatter: p => p.value !== null ? `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%` : '—',
      cellStyle: (p: { value: number | null }) =>
        ({ color: p.value === null ? '#94a3b8' : p.value >= 0 ? '#22c55e' : '#ef4444' }),
    },
    {
      field: 'status', headerName: 'Status', width: 90,
      cellRenderer: (p: { value: string }) =>
        `<span style="padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;background:${p.value === 'Active' ? '#22c55e22' : '#64748b22'};color:${p.value === 'Active' ? '#22c55e' : '#94a3b8'}">${p.value}</span>`,
    },
    { field: 'priceDate', headerName: 'Price Date', width: 110, cellStyle: { color: '#64748b' } },
    { field: 'updated',   headerName: 'Updated',    width: 110, cellStyle: { color: '#64748b' } },
  ]

  return (
    <div
      style={{ padding: '0 4px 12px' }}
      onClick={e => {
        const el = (e.target as HTMLElement).closest('a[data-id]') as HTMLAnchorElement | null
        if (el) { e.preventDefault(); router.push(`/securities/${el.dataset.id}`) }
      }}
    >
      <AppGrid
        rowData={rows}
        columnDefs={colDefs}
        exportFilename="securities"
        height={520}
      />
    </div>
  )
}
