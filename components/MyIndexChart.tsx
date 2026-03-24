'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface IndexPoint { date: string; value: number; portfolioValue: number }

const RANGES = [
  { label: '1M',  days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'All', days: 3650 },
]

const fmtDate  = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
const fmtValue = (v: number) => v.toFixed(2)
const fmtINR   = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

export default function MyIndexChart({ currency = 'INR' }: { currency?: string }) {
  const [allPoints, setAllPoints] = useState<IndexPoint[]>([])
  const [range,     setRange]     = useState(365)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Fetch once with max window — filter client-side for range switching
  useEffect(() => {
    fetch('/api/my-index?days=3650')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setAllPoints(d.points ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const cutoff = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10)
  const points = allPoints.filter(p => p.date >= cutoff)

  const latest  = points.at(-1)
  const first   = points[0]
  const isUp    = latest && first ? latest.value >= first.value : true
  const minV    = points.length ? Math.min(...points.map(p => p.value)) * 0.995 : 95
  const maxV    = points.length ? Math.max(...points.map(p => p.value)) * 1.005 : 105
  const changePct = first && latest ? ((latest.value - first.value) / first.value) * 100 : null

  const color = isUp ? '#22c55e' : '#ef4444'

  if (loading) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">Your Index</span></div>
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
          Computing your personal index…
        </div>
      </div>
    )
  }

  if (error || !points.length) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">Your Index</span></div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">Not enough data yet</div>
            <div className="empty-state-text">Import trades and ensure price history is populated to see your index.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div>
          <span className="card-title">Your Index</span>
          {latest && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {fmtValue(latest.value)}
              </span>
              {changePct !== null && (
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color }}>
                  {changePct >= 0 ? '▲ +' : '▼ '}{changePct.toFixed(2)}%
                </span>
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Base 100 · {fmtINR(latest.portfolioValue)}
              </span>
            </div>
          )}
        </div>

        {/* Range buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.days)}
              style={{
                padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                border: range === r.days ? `1.5px solid ${color}` : '1px solid var(--color-border)',
                background: range === r.days ? `${color}18` : 'transparent',
                color: range === r.days ? color : 'var(--color-text-muted)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 260, padding: '8px 0 4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="myIndexGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: '#64748b' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minV, maxV]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={v => v.toFixed(0)}
              width={52}
            />
            <ReferenceLine y={100} stroke="#64748b" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'Base 100', position: 'insideTopLeft', fontSize: 10, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={((val: unknown, name: string) => {
                const v = val as number
                if (name === 'value') return [v.toFixed(2), 'Index']
                if (name === 'portfolioValue') return [fmtINR(v), 'Portfolio']
                return [v, name]
              }) as never}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#myIndexGrad)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', padding: '0 4px 4px', textAlign: 'right' }}>
        Divisor-adjusted for deposits &amp; withdrawals · Base 100 on first trade date
      </div>
    </div>
  )
}
