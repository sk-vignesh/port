import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatPercent, formatShares } from '@/lib/format'
import dynamicImport from 'next/dynamic'
import type { HoldingRow } from '@/components/grids/HoldingsGrid'
export const dynamic = 'force-dynamic'

const HoldingsGrid = dynamicImport(() => import('@/components/grids/HoldingsGrid'), { ssr: false })

interface PortfolioPerf {
  portfolioId: string
  portfolioName: string
  holdings: HoldingRow[]
  currentValue: number
  investedCapital: number
  absoluteGain: number
  ttwror: number
}

async function fetchPortfolioPerf(portfolioId: string, baseUrl: string): Promise<PortfolioPerf | null> {
  try {
    const r = await fetch(`${baseUrl}/api/portfolios/${portfolioId}/performance`, { cache: 'no-store' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export default async function AllHoldingsPage({ searchParams }: { searchParams?: { portfolio?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('is_retired', false)
    .order('name')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('base_currency')
    .eq('user_id', user.id)
    .single()

  const currency = settings?.base_currency ?? 'INR'

  // Fetch perf for all portfolios in parallel (server-side)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const perfResults = await Promise.all(
    (portfolios ?? []).map(p =>
      fetchPortfolioPerf(p.id, baseUrl).then(r => r ? { ...r, portfolioId: p.id, portfolioName: p.name } : null)
    )
  )

  // Aggregate holdings by security across all portfolios
  const holdingMap = new Map<string, HoldingRow & { portfolios: string[] }>()
  for (const perf of perfResults) {
    if (!perf) continue
    for (const h of (perf.holdings ?? [] as HoldingRow[])) {
      const existing = holdingMap.get(h.securityId)
      if (existing) {
        existing.shares += h.shares
        existing.costBasis += h.costBasis
        existing.currentValue = (existing.currentValue ?? 0) + (h.currentValue ?? 0)
        existing.gain = (existing.gain ?? 0) + (h.gain ?? 0)
        existing.portfolios.push(perf.portfolioName)
      } else {
        holdingMap.set(h.securityId, { ...h, portfolios: [perf.portfolioName] })
      }
    }
  }

  // Recompute derived fields over aggregated values
  const allHoldings: HoldingRow[] = [...holdingMap.values()].map(h => {
    const gainPct = h.costBasis > 0 && h.gain != null ? h.gain / h.costBasis : null
    return {
      securityId: h.securityId,
      name: h.name,
      currency: h.currency,
      shares: h.shares,
      avgCostPerShare: h.shares > 0 ? h.costBasis / h.shares : 0,
      costBasis: h.costBasis,
      currentValue: h.currentValue,
      currentPrice: h.currentPrice,
      gain: h.gain,
      gainPct,
    }
  }).sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))

  const totalCost  = allHoldings.reduce((s, h) => s + h.costBasis, 0)
  const totalValue = allHoldings.reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const totalGain  = totalValue - totalCost
  const totalPct   = totalCost > 0 ? totalGain / totalCost : 0

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">All Holdings</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Consolidated view across all your portfolios
          </p>
        </div>
        <div className="flex flex-gap-2">
          {(portfolios ?? []).map(p => (
            <Link key={p.id} href={`/portfolios/${p.id}`} className="btn btn-secondary btn-sm">
              {p.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="card mb-6">
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '24px 16px', padding: '8px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Current Value</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{formatAmount(totalValue, currency)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Invested</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{formatAmount(totalCost, currency)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Abs. Gain / Loss</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: totalGain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatAmount(totalGain, currency)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Return %</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: totalPct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatPercent(totalPct * 100)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Positions</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{allHoldings.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings AG Grid */}
      {allHoldings.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No holdings yet</div>
            <div className="empty-state-text">Add trades to your portfolios to see consolidated holdings here.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Holdings ({allHoldings.length})</span>
            <span className="text-sm text-muted">{(portfolios ?? []).length} portfolios consolidated</span>
          </div>
          <HoldingsGrid rows={allHoldings} />
        </div>
      )}
    </>
  )
}
