'use client'

import { useState } from 'react'
import type { HoldingRow } from '@/components/grids/HoldingsGrid'
import dynamic from 'next/dynamic'
import { formatAmount, formatPercent } from '@/lib/format'
import Link from 'next/link'

const HoldingsGrid = dynamic(() => import('@/components/grids/HoldingsGrid'), { ssr: false })

const ASSET_CLASS_ICONS: Record<string, string> = {
  EQUITY: '📈', COMMODITY: '🥇', FIXED_INCOME: '🏦', REAL_ESTATE: '🏠',
}
const ASSET_CLASS_LABELS: Record<string, string> = {
  EQUITY: 'Stocks & ETFs', COMMODITY: 'Commodities',
  FIXED_INCOME: 'Fixed Income / Bonds', REAL_ESTATE: 'Real Estate',
}

export interface HoldingRowWithClass extends HoldingRow {
  assetClass: string | null
  portfolioName: string
  portfolioId: string
}

interface AssetClassGroup {
  key: string
  label: string
  icon: string
  portfolioId: string
  rows: HoldingRowWithClass[]
  totalValue: number
  totalCost: number
  totalGain: number
  gainPct: number
}

export default function HoldingsClient({
  groups,
  totalValue,
  totalCost,
  totalGain,
  totalPct,
  currency,
}: {
  groups: AssetClassGroup[]
  totalValue: number
  totalCost: number
  totalGain: number
  totalPct: number
  currency: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    // Start with all expanded
    new Set(groups.map(g => g.key))
  )

  const toggle = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">All Holdings</h1>
          <p className="page-subtitle">Your investments across all asset classes</p>
        </div>
        <Link href="/portfolios" className="btn btn-primary">↑↓ Record Trade</Link>
      </div>

      {/* Summary strip */}
      <div className="card mb-6" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Total Value
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              {formatAmount(totalValue, currency)}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {[
            { label: 'Invested', value: formatAmount(totalCost, currency), color: '' },
            { label: 'Gain / Loss', value: `${totalGain >= 0 ? '+' : ''}${formatAmount(totalGain, currency)}`, color: totalGain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: 'Return', value: `${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(1)}%`, color: totalPct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: 'Positions', value: String(groups.reduce((s, g) => s + g.rows.length, 0)), color: '' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Asset class groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(g => {
          const isOpen = expanded.has(g.key)
          const alloc = totalCost > 0 ? (g.totalCost / totalCost) * 100 : 0
          return (
            <div key={g.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Group header — click to expand/collapse */}
              <button
                onClick={() => toggle(g.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  borderBottom: isOpen ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{g.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                    {g.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {g.rows.length} position{g.rows.length !== 1 ? 's' : ''} · {alloc.toFixed(0)}% of portfolio
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Value</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>{formatAmount(g.totalValue, currency)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Return</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: g.gainPct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {g.gainPct >= 0 ? '+' : ''}{(g.gainPct * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      href={`/portfolios/${g.portfolioId}/transactions/new?type=BUY`}
                      onClick={e => e.stopPropagation()}
                      style={{ padding: '5px 12px', borderRadius: 6, background: '#22c55e18', color: '#22c55e', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', border: '1px solid #22c55e30' }}
                    >↑ Buy</Link>
                    <Link
                      href={`/portfolios/${g.portfolioId}/transactions/new?type=SELL`}
                      onClick={e => e.stopPropagation()}
                      style={{ padding: '5px 12px', borderRadius: 6, background: '#ef444418', color: '#ef4444', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', border: '1px solid #ef444430' }}
                    >↓ Sell</Link>
                  </div>
                  <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                </div>
              </button>

              {/* Holdings grid */}
              {isOpen && (
                <div style={{ padding: '8px 8px' }}>
                  <HoldingsGrid rows={g.rows} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
