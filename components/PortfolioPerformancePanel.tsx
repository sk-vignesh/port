'use client'

import { useEffect, useState } from 'react'
import { formatAmount, formatPercent } from '@/lib/format'
import dynamicImport from 'next/dynamic'
import type { HoldingRow } from '@/components/grids/HoldingsGrid'

const HoldingsGrid = dynamicImport(() => import('@/components/grids/HoldingsGrid'), { ssr: false })

interface Holding {
  securityId: string; name: string; currency: string
  shares: number; costBasis: number
  currentValue: number | null; currentPrice: number | null
  avgCostPerShare: number; gain: number | null; gainPct: number | null
}
interface PerfData {
  ttwror: number; ttwrorAnnualized: number; irr: number | null
  absoluteGain: number; investedCapital: number; currentValue: number
  since: string | null; years: number; holdings: Holding[]
}

function PctBadge({ value, label }: { value: number; label: string }) {
  const pos = value >= 0
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em',
        color: pos ? 'var(--color-success)' : 'var(--color-danger)',
      }}>
        {formatPercent(value * 100)}
      </div>
    </div>
  )
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function PortfolioPerformancePanel({ portfolioId, currency }: { portfolioId: string; currency: string }) {
  const [data, setData] = useState<PerfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/portfolios/${portfolioId}/performance`)
      .then(r => r.json())
      .then(j => { setData(j); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [portfolioId])

  if (loading) return (
    <div className="card mb-6">
      <div className="card-body" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
        Calculating performance…
      </div>
    </div>
  )

  if (error) return (
    <div className="card mb-6">
      <div className="card-body" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '20px 24px' }}>
        ⚠️ Could not load performance data — {error}
      </div>
    </div>
  )

  if (!data || (data.investedCapital === 0 && data.currentValue === 0)) return (
    <div className="card mb-6">
      <div className="card-body" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '20px 24px', textAlign: 'center' }}>
        Add your first trade to see performance metrics.
      </div>
    </div>
  )

  const noPrices = data.currentValue === 0 && data.investedCapital > 0

  return (
    <>
      {/* Performance metrics strip */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">Performance</span>
          {data.since && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Since {data.since} · {data.years.toFixed(1)}y
            </span>
          )}
        </div>
        <div className="card-body">
          {noPrices ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '12px 0' }}>
              Add price history for your securities to see performance metrics.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '24px 16px', padding: '8px 0' }}>
              <StatBox
                label="Current Value"
                value={formatAmount(data.currentValue, currency)}
              />
              <StatBox
                label="Invested Capital"
                value={formatAmount(data.investedCapital, currency)}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  Abs. Gain / Loss
                </div>
                <div style={{
                  fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em',
                  color: data.absoluteGain >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {formatAmount(data.absoluteGain, currency)}
                </div>
              </div>
              <PctBadge value={data.ttwror} label="TTWROR (total)" />
              <PctBadge value={data.ttwrorAnnualized} label="TTWROR (p.a.)" />
              {data.irr != null && (
                <PctBadge value={data.irr} label="IRR (p.a.)" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enriched holdings — AG Grid */}
      {data.holdings.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <span className="card-title">Holdings ({data.holdings.length})</span>
          </div>
          <HoldingsGrid rows={data.holdings as HoldingRow[]} />
        </div>
      )}
    </>
  )
}
