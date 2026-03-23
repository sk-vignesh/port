'use client'
import dynamicImport from 'next/dynamic'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'

const AppGrid = dynamicImport(() => import('@/components/AppGrid'), { ssr: false })

const fmtINR = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)
    : '—'

const fmtPct = (v: number | null) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

const pctStyle = (p: { value: number | null }) => ({
  color: p.value == null ? 'var(--color-text-muted)'
    : p.value > 0 ? 'var(--color-success)' : p.value < 0 ? 'var(--color-danger)'
    : 'var(--color-text-secondary)',
  fontWeight: 600,
})

export interface ReportsSummaryRow {
  label: string; value: number; change1d: number | null; change1w: number | null; change1m: number | null
}

export interface ReportsSecurityRow {
  secId: string; name: string; ticker: string | null
  netShares: number; currentPrice: number | null; currentValue: number | null
  chg1d: number | null; chg1w: number | null; chg1m: number | null
}

/** Compact summary grid — By Portfolio or By Segment */
export function ReportsSummaryGrid({ rows, label = 'Name' }: { rows: ReportsSummaryRow[]; label?: string }) {
  const colDefs: ColDef[] = [
    { field: 'label', headerName: label, flex: 1, minWidth: 120 },
    {
      field: 'value', headerName: 'Value', type: 'numericColumn', width: 150,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value > 0 ? p.value : null),
    },
    {
      field: 'change1d', headerName: 'Today', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
      cellStyle: pctStyle as never,
    },
    {
      field: 'change1w', headerName: '1 Week', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
      cellStyle: pctStyle as never,
    },
    {
      field: 'change1m', headerName: '1 Month', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
      cellStyle: pctStyle as never,
    },
  ]
  return <AppGrid rowData={rows} columnDefs={colDefs} exportFilename="performance_summary" height={180 + rows.length * 44} showSearch={false} />
}

/** Full security-level breakdown */
export function ReportsSecurityGrid({ rows }: { rows: ReportsSecurityRow[] }) {
  const colDefs: ColDef[] = [
    {
      field: 'name', headerName: 'Security', flex: 1, minWidth: 160,
      cellStyle: { color: 'var(--color-accent-light)' },
    },
    { field: 'ticker', headerName: 'Symbol', width: 110, cellStyle: { color: 'var(--color-text-muted)' } },
    {
      field: 'netShares', headerName: 'Shares', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => Math.round(p.value).toLocaleString('en-IN'),
    },
    {
      field: 'currentPrice', headerName: 'Price', type: 'numericColumn', width: 130,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
    },
    {
      field: 'currentValue', headerName: 'Value', type: 'numericColumn', width: 140,
      valueFormatter: (p: ValueFormatterParams) => fmtINR(p.value),
      sort: 'desc',
    },
    {
      field: 'chg1d', headerName: 'Today', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
      cellStyle: pctStyle as never,
    },
    {
      field: 'chg1w', headerName: '1 Week', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
      cellStyle: pctStyle as never,
    },
    {
      field: 'chg1m', headerName: '1 Month', type: 'numericColumn', width: 100,
      valueFormatter: (p: ValueFormatterParams) => fmtPct(p.value),
      cellStyle: pctStyle as never,
    },
  ]
  return <AppGrid rowData={rows} columnDefs={colDefs} exportFilename="holdings" height={460} />
}
