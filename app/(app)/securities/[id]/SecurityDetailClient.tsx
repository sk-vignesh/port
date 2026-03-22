'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ColDef } from 'ag-grid-community'

const AppGrid = dynamic(() => import('@/components/AppGrid'), { ssr: false })

interface PriceRow    { date: string; value: number }
interface TxRow       { id: string; portfolio: string; type: string; date: string; shares: number; price: number; amount: number; currency: string; note: string }
interface EventRow    { id: string; date: string; type: string; details: Record<string, unknown>; note?: string }

interface Props {
  securityId: string
  currency: string
  prices: PriceRow[]
  transactions: TxRow[]
  events: EventRow[]
}

const CHART_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 9999 },
]

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
const fmtPrice = (v: number, cur: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(v)

const txCols: ColDef[] = [
  { field: 'date',      headerName: 'Date',       width: 110 },
  { field: 'portfolio', headerName: 'Portfolio',   width: 120 },
  { field: 'type',      headerName: 'Type',        width: 110,
    cellRenderer: (p: { value: string }) => {
      const colors: Record<string, string> = { BUY: '#22c55e', SELL: '#ef4444', DELIVERY_INBOUND: '#3b82f6', DELIVERY_OUTBOUND: '#f59e0b', TRANSFER_IN: '#8b5cf6', TRANSFER_OUT: '#64748b' }
      return `<span style="padding:2px 8px;border-radius:4px;background:${colors[p.value] ?? '#64748b'}22;color:${colors[p.value] ?? '#94a3b8'};font-weight:600;font-size:0.78rem">${p.value.replace(/_/g,' ')}</span>`
    } },
  { field: 'shares', headerName: 'Shares', width: 100, type: 'numericColumn',
    valueFormatter: p => p.value != null ? String(Math.round(p.value)) : '' },
  { field: 'price', headerName: 'Price (₹)', width: 110, type: 'numericColumn',
    valueFormatter: p => p.value != null ? new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(p.value) : '' },
  { field: 'amount', headerName: 'Amount (₹)', width: 130, type: 'numericColumn',
    valueFormatter: p => p.value != null ? new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(p.value) : '' },
  { field: 'note', headerName: 'Note', flex: 1, minWidth: 140 },
]

const eventCols: ColDef[] = [
  { field: 'date',    headerName: 'Date',    width: 110 },
  { field: 'type',    headerName: 'Type',    width: 120 },
  { field: 'details', headerName: 'Details', flex: 1,
    valueFormatter: p => typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value ?? '') },
  { field: 'note',    headerName: 'Note',    width: 200 },
]

const priceCols: ColDef[] = [
  { field: 'date',  headerName: 'Date',     width: 120 },
  { field: 'value', headerName: 'Price (₹)', flex: 1, type: 'numericColumn',
    valueFormatter: p => p.value != null ? new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(p.value) : '' },
]

export default function SecurityDetailClient({ securityId, currency, prices, transactions, events }: Props) {
  const [range, setRange] = useState(90)
  const cutoff = new Date(Date.now() - range * 864e5).toISOString().slice(0, 10)
  const chartData = prices.filter(p => p.date >= cutoff)

  const minV = Math.min(...chartData.map(p => p.value)) * 0.995
  const maxV = Math.max(...chartData.map(p => p.value)) * 1.005
  const isUp = chartData.length > 1 && chartData.at(-1)!.value >= chartData[0].value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Price chart ── */}
      {prices.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Price Chart</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {CHART_RANGES.map(r => (
                <button key={r.label} type="button" onClick={() => setRange(r.days)}
                  style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
                    border: range === r.days ? '1.5px solid var(--color-accent-light)' : '1px solid var(--color-border)',
                    background: range === r.days ? 'var(--color-accent-glow)' : 'transparent',
                    color: range === r.days ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 260, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
                <YAxis domain={[minV, maxV]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `₹${(v/1).toFixed(0)}`} width={70} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={((v: number) => [fmtPrice(v, currency), 'Price']) as never}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="value" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth={2} fill="url(#chartGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Transaction history ── */}
      <div className="card">
        <div className="card-header"><span className="card-title">Transaction History</span></div>
        <div style={{ padding: '0 4px 12px' }}>
          {transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-text">No trades recorded for this security</div>
            </div>
          ) : (
            <AppGrid rowData={transactions} columnDefs={txCols} exportFilename="transactions" height={320} />
          )}
        </div>
      </div>

      {/* ── Events ── */}
      {events.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Corporate Events</span></div>
          <div style={{ padding: '0 4px 12px' }}>
            <AppGrid rowData={events} columnDefs={eventCols} exportFilename="events" height={220} />
          </div>
        </div>
      )}

      {/* ── Full price history ── */}
      {prices.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Price History</span>
            <a href={`/securities/${securityId}/prices`} style={{ fontSize: '0.78rem', color: 'var(--color-accent-light)' }}>Manage →</a>
          </div>
          <div style={{ padding: '0 4px 12px' }}>
            <AppGrid rowData={[...prices].reverse()} columnDefs={priceCols} exportFilename="price_history" height={320} />
          </div>
        </div>
      )}
    </div>
  )
}
