'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, ReferenceLine,
  CartesianGrid,
} from 'recharts'

// ─── Design tokens (match CSS variables for both themes) ─────────────────────
const BLUE   = '#3b82f6'
const BLUE_L = '#60a5fa'
const GREEN  = '#22c55e'
const RED    = '#ef4444'
const MUTED  = '#56698a'
const GRID   = 'rgba(255,255,255,0.05)'

// Allocation palette: restrained blues + slate — not rainbow
const ALLOC_COLORS = ['#3b82f6', '#64748b', '#475569', '#94a3b8', '#1d4ed8', '#334155']

// ─── Types ────────────────────────────────────────────────────────────────────
interface PricePoint  { date: string; value: number }
interface AllocSlice  { name: string; value: number }
interface PnLBar      { name: string; gain: number; pct: number }

interface Props {
  priceHistory: PricePoint[]           // [{date, value}] for the primary security or portfolio
  allocation:   AllocSlice[]           // [{name, value}] — cost basis per holding
  pnl:          PnLBar[]               // [{name, gain, pct}] — per holding
  currency:     string
}

// ─── Shared tooltip style ─────────────────────────────────────────────────────
const tipStyle: React.CSSProperties = {
  background: '#111827',
  border: '1px solid #1e2d4a',
  borderRadius: 5,
  fontSize: '0.78rem',
  color: '#f0f4ff',
  padding: '8px 12px',
}

// ─── Custom tooltip for price chart ──────────────────────────────────────────
function PriceTip({ active, payload, label, currency }: { active?: boolean; payload?: {value:number}[]; label?: string; currency: string }) {
  if (!active || !payload?.length) return null
  const val = (payload[0].value / 100).toLocaleString('en-US', { style: 'currency', currency })
  return <div style={tipStyle}><div style={{ color: MUTED, marginBottom: 2 }}>{label}</div><strong>{val}</strong></div>
}

// ─── Custom tooltip for PnL chart ────────────────────────────────────────────
function PnLTip({ active, payload, currency }: { active?: boolean; payload?: {value:number; payload: PnLBar}[]; currency: string }) {
  if (!active || !payload?.length) return null
  const { gain, pct } = payload[0].payload
  const fmt = (n: number) => (n / 100).toLocaleString('en-US', { style: 'currency', currency })
  const pos = gain >= 0
  return (
    <div style={tipStyle}>
      <div style={{ color: pos ? GREEN : RED, fontWeight: 700 }}>
        {pos ? '+' : ''}{fmt(gain)} ({pos ? '+' : ''}{(pct * 100).toFixed(2)}%)
      </div>
    </div>
  )
}

// ─── Allocation tooltip ───────────────────────────────────────────────────────
function AllocTip({ active, payload, fmtCcy }: { active?: boolean; payload?: { name: string; value: number }[]; fmtCcy: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tipStyle}>
      <div style={{ color: MUTED, marginBottom: 2 }}>{payload[0].name}</div>
      <strong>{fmtCcy(payload[0].value)}</strong>
    </div>
  )
}

// ─── Allocation custom label ──────────────────────────────────────────────────
function AllocLabel({ cx, cy, midAngle, outerRadius, name, percent }:
  { cx: number; cy: number; midAngle: number; outerRadius: number; name: string; percent: number }) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = outerRadius + 28
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill={MUTED} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontFamily="Montserrat, sans-serif">
      {name.length > 14 ? name.slice(0, 13) + '…' : name} {(percent * 100).toFixed(0)}%
    </text>
  )
}

export default function DashboardCharts({ priceHistory, allocation, pnl, currency }: Props) {
  const hasPrices = priceHistory.length > 1
  const hasAlloc  = allocation.length > 0
  const hasPnL    = pnl.length > 0

  if (!hasPrices && !hasAlloc && !hasPnL) return null

  const formatMonth = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  const fmtCcy = (n: number) =>
    (n / 100).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })

  // Gradient min/max for price chart
  const prices = priceHistory.map(p => p.value)
  const minP = Math.min(...prices) * 0.98
  const maxP = Math.max(...prices) * 1.02

  return (
    <div style={{ display: 'grid', gridTemplateColumns: hasPnL ? '1fr 280px' : '1fr', gap: 20, marginBottom: 24 }}>
      {/* Left column: price history + allocation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Price / Value History */}
        {hasPrices && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Price History (12 months)</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={priceHistory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={BLUE} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatMonth} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[minP, maxP]} tickFormatter={fmtCcy} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip content={<PriceTip currency={currency} />} />
                  <Area type="monotone" dataKey="value" stroke={BLUE_L} strokeWidth={2} fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: BLUE_L }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Allocation donut */}
        {hasAlloc && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Portfolio Allocation</span>
              <span style={{ fontSize: '0.72rem', color: MUTED }}>by cost basis</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8, display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={allocation}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                    label={AllocLabel as never}
                  >
                    {allocation.map((_, i) => (
                      <Cell key={i} fill={ALLOC_COLORS[i % ALLOC_COLORS.length]} opacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip content={(p) => <AllocTip active={p.active} payload={p.payload as unknown as { name: string; value: number }[] | undefined} fmtCcy={fmtCcy} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Right column: P&L per holding */}
      {hasPnL && (
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <span className="card-title">Holding P&amp;L</span>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={Math.max(180, pnl.length * 52)}>
              <BarChart data={pnl} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tickFormatter={fmtCcy} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={60}
                  tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 7) + '…' : v} />
                <Tooltip content={<PnLTip currency={currency} />} />
                <ReferenceLine x={0} stroke={MUTED} strokeOpacity={0.4} />
                <Bar dataKey="gain" radius={[0, 3, 3, 0]}>
                  {pnl.map((entry, i) => (
                    <Cell key={i} fill={entry.gain >= 0 ? GREEN : RED} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
