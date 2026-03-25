'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatAmount } from '@/lib/format'
import Tooltip from '@/components/Tooltip'

// ── Types ─────────────────────────────────────────────────────────────────
interface GainRow {
  securityId:        string
  name:              string
  ticker:            string | null
  currency:          string
  shares:            number
  avgCostPerShare:   number   // × 100
  costBasis:         number   // × 100
  currentPrice:      number | null  // × 100
  currentValue:      number | null  // × 100
  unrealizedGain:    number | null  // × 100
  unrealizedGainPct: number | null
  realizedGain:      number   // × 100
  totalGain:         number   // × 100
  xirr:              number | null   // decimal, e.g. 0.1547 = 15.47%
  cagr:              number | null   // decimal, e.g. 0.2247 = 22.47%
}

interface Summary {
  totalCost:           number
  totalValue:          number
  totalUnrealized:     number
  totalUnrealizedPct:  number
  totalRealized:       number
  totalGain:           number
  positionsTotal:      number
  positionsWithPrice:  number
}

// ── Helpers ────────────────────────────────────────────────────────────────
function pct(val: number | null) {
  if (val == null) return null
  return `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`
}

function gainColor(val: number | null) {
  if (val == null || val === 0) return 'var(--color-text-secondary)'
  return val > 0 ? 'var(--color-positive, #22c55e)' : 'var(--color-negative, #ef4444)'
}

function FmtAmount({ value, currency }: { value: number | null; currency?: string }) {
  if (value == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ color: gainColor(value) }}>
      {value >= 0 ? '+' : ''}{formatAmount(value, currency ?? 'INR')}
    </span>
  )
}

// ── Sort keys ──────────────────────────────────────────────────────────────
type SortKey = 'name' | 'shares' | 'costBasis' | 'currentValue' | 'unrealizedGain' | 'unrealizedGainPct' | 'realizedGain' | 'totalGain' | 'xirr' | 'cagr'

export default function GainsPage() {
  const [rows,    setRows]    = useState<GainRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [sort,    setSort]    = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'totalGain', dir: -1 })
  const [filter,  setFilter]  = useState('')  // name / ticker search

  useEffect(() => {
    fetch('/api/gains')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRows(d.holdings ?? [])
        setSummary(d.summary ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Sorting
  const toggleSort = (key: SortKey) => {
    setSort(s => s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 })
  }

  const sorted = [...rows]
    .filter(r =>
      !filter ||
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      (r.ticker ?? '').toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sort.key] ?? -Infinity
      const bv = b[sort.key] ?? -Infinity
      if (typeof av === 'string' && typeof bv === 'string')
        return av.localeCompare(bv) * sort.dir
      return ((av as number) - (bv as number)) * sort.dir
    })

  const SortTh = ({ colKey, label, right }: { colKey: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(colKey)}
      className={right ? 'table-right' : ''}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}{sort.key === colKey ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  )

  // ── Summary metric cards ─────────────────────────────────────────────
  const currency = rows[0]?.currency ?? 'INR'

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h1 className="page-title">Gains & P&L</h1>
          <p className="page-subtitle">Loading positions…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-header">
        <div>
          <h1 className="page-title">Gains & P&L</h1>
          <p className="page-subtitle" style={{ color: 'var(--color-negative, #ef4444)' }}>Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Gains & P&L</h1>
          <p className="page-subtitle">
            {summary?.positionsTotal ?? 0} positions
            {summary && summary.positionsTotal > summary.positionsWithPrice &&
              ` · ${summary.positionsTotal - summary.positionsWithPrice} without live price`}
          </p>
        </div>
        <input
          type="search"
          placeholder="Search name or ticker…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: '0.82rem',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-primary)', width: 200, outline: 'none',
          }}
        />
      </div>

      {/* ── Summary cards ───────────────────────────────────────────── */}
      {summary && (
        <div className="grid-4 mb-6">
          <div className="metric-card">
            <div className="metric-label">Current Value</div>
            <div className="metric-value" style={{ fontSize: '1.35rem' }}>
              {formatAmount(summary.totalValue, currency)}
            </div>
            <div className="metric-change" style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', marginTop: 4 }}>
              Invested: {formatAmount(summary.totalCost, currency)}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Unrealised Gain <Tooltip content="Profit or loss on positions you still hold, based on the latest market price vs what you paid." /></div>
            <div className="metric-value" style={{ fontSize: '1.35rem', color: gainColor(summary.totalUnrealized) }}>
              {summary.totalUnrealized >= 0 ? '+' : ''}{formatAmount(summary.totalUnrealized, currency)}
            </div>
            <div className="metric-change" style={{ color: gainColor(summary.totalUnrealizedPct) }}>
              {pct(summary.totalUnrealizedPct)} on cost
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Realised Gain <Tooltip content="Profit or loss you have already locked in by selling. This counts toward your actual tax liability." /></div>
            <div className="metric-value" style={{ fontSize: '1.35rem', color: gainColor(summary.totalRealized) }}>
              {summary.totalRealized >= 0 ? '+' : ''}{formatAmount(summary.totalRealized, currency)}
            </div>
            <div className="metric-change text-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
              From closed / partial sells
            </div>
          </div>

          <div className="metric-card" style={{
            background: summary.totalGain >= 0
              ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
            borderColor: summary.totalGain >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
          }}>
            <div className="metric-label">Total Gain</div>
            <div className="metric-value" style={{ fontSize: '1.35rem', color: gainColor(summary.totalGain) }}>
              {summary.totalGain >= 0 ? '+' : ''}{formatAmount(summary.totalGain, currency)}
            </div>
            <div className="metric-change" style={{ color: gainColor(summary.totalGain), fontSize: '0.8rem' }}>
              Realised + Unrealised
            </div>
          </div>
        </div>
      )}

      {/* ── Holdings table ──────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No positions found</div>
            <div className="empty-state-text">
              Import your trades first to see gains and P&L here.
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <SortTh colKey="name"             label="Security" />
                  <SortTh colKey="shares"           label="Qty"            right />
                  <SortTh colKey="costBasis"        label="Invested"       right />
                  <th className="table-right" style={{ whiteSpace: 'nowrap' }}>Avg Cost <Tooltip content="Average price you paid per unit, weighted by all your buy transactions." /></th>
                  <th className="table-right" style={{ whiteSpace: 'nowrap' }}>CMP <Tooltip content="Current Market Price — the latest available price for this security." /></th>
                  <SortTh colKey="currentValue"     label="Mkt Value"      right />
                  <SortTh colKey="unrealizedGain"   label="Unreal. Gain"   right />
                  <SortTh colKey="unrealizedGainPct"label="Unreal. %"      right />
                  <SortTh colKey="realizedGain"     label="Real. Gain"     right />
                  <SortTh colKey="totalGain"        label="Total Gain"     right />
                  <SortTh colKey="xirr"             label="XIRR"           right />
                  <SortTh colKey="cagr"             label="CAGR"           right />
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr key={row.securityId}>
                    {/* Security name + ticker */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                        <Link
                          href={`/securities/${row.securityId}`}
                          style={{ color: 'var(--color-accent-light)', textDecoration: 'none' }}
                          prefetch={false}
                        >
                          {row.name}
                        </Link>
                      </div>
                      {row.ticker && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {row.ticker}
                        </div>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="table-right text-muted">
                      {row.shares.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                    </td>

                    {/* Invested (cost basis) */}
                    <td className="table-right">
                      {formatAmount(row.costBasis, row.currency)}
                    </td>

                    {/* Avg cost per share */}
                    <td className="table-right text-muted">
                      {row.shares > 0
                        ? formatAmount(Math.round(row.avgCostPerShare), row.currency)
                        : '—'}
                    </td>

                    {/* Current market price */}
                    <td className="table-right">
                      {row.currentPrice != null
                        ? formatAmount(row.currentPrice, row.currency)
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>

                    {/* Market value */}
                    <td className="table-right">
                      {row.currentValue != null
                        ? formatAmount(row.currentValue, row.currency)
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>

                    {/* Unrealised gain */}
                    <td className="table-right">
                      <FmtAmount value={row.unrealizedGain} currency={row.currency} />
                    </td>

                    {/* Unrealised % */}
                    <td className="table-right">
                      {row.unrealizedGainPct != null
                        ? <span style={{ color: gainColor(row.unrealizedGainPct), fontWeight: 600 }}>
                            {pct(row.unrealizedGainPct)}
                          </span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>

                    {/* Realised gain */}
                    <td className="table-right">
                      <FmtAmount value={row.realizedGain} currency={row.currency} />
                    </td>

                    {/* Total gain */}
                    <td className="table-right">
                      <span style={{ fontWeight: 700, color: gainColor(row.totalGain) }}>
                        {row.totalGain >= 0 ? '+' : ''}{formatAmount(row.totalGain, row.currency)}
                      </span>
                    </td>

                    {/* XIRR */}
                    <td className="table-right">
                      {row.xirr != null
                        ? <span style={{ fontWeight: 600, color: gainColor(row.xirr) }}>
                            {row.xirr >= 0 ? '+' : ''}{(row.xirr * 100).toFixed(2)}%
                          </span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>

                    {/* CAGR */}
                    <td className="table-right">
                      {row.cagr != null
                        ? <span style={{ fontWeight: 600, color: gainColor(row.cagr) }}>
                            {row.cagr >= 0 ? '+' : ''}{(row.cagr * 100).toFixed(2)}%
                          </span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────── */}
      {summary && (
        <p style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
          Prices from NSE price history · Last updated Jan 2026 ·
          {summary.positionsWithPrice}/{summary.positionsTotal} positions have price data
        </p>
      )}
    </>
  )
}
