import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount } from '@/lib/format'
import { buildHoldings, enrichHoldings } from '@/lib/performance'
import SampleDataBanner from '@/components/SampleDataBanner'
import DashboardCharts from '@/components/DashboardCharts'
import MyIndexChart from '@/components/MyIndexChart'
import { ASSET_CLASS_ICONS } from '@/lib/assetClasses'
import DashboardTradeButton from '@/components/DashboardTradeButton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: accounts },
    { data: portfolios },
    { data: settings },
  ] = await Promise.all([
    supabase.from('accounts').select('id, name, currency_code, is_retired').eq('is_retired', false),
    supabase.from('portfolios').select('id, name, is_retired, asset_class').eq('is_retired', false),
    supabase.from('user_settings').select('base_currency').eq('user_id', user.id).single(),
  ])

  const baseCurrency = settings?.base_currency ?? 'INR'
  // Supabase types don't yet include asset_class (added in migration 009).
  // Cast is safe: query explicitly selects asset_class, default 'EQUITY' on new rows.
  // Remove once types are regenerated after migration 009 is applied.
  type Portfolio = { id: string; name: string; is_retired: boolean; asset_class: string }
  const portfolioList = (portfolios as unknown as Portfolio[] | null) ?? []
  const portfolioIds = portfolioList.map(p => p.id)
  const accountIds   = (accounts ?? []).map(a => a.id)

  // New users with no data → guided onboarding
  if (!portfolioList.length && !accountIds.length) redirect('/onboard')

  const [
    { data: recentPortTxn },
    { data: allPortTxns },
    { data: latestPrices },
  ] = await Promise.all([
    supabase.from('portfolio_transactions')
      .select('id, type, date, amount, currency_code, shares, securities(name), portfolios(name)')
      .in('portfolio_id', portfolioIds).order('date', { ascending: false }).limit(6),

    supabase.from('portfolio_transactions')
      .select('*, securities(name, currency_code)')
      .in('portfolio_id', portfolioIds)
      .order('date', { ascending: true }),

    supabase.from('security_prices')
      .select('security_id, value, date')
      .order('date', { ascending: false }),
  ])

  const latestPriceMap = new Map<string, number>()
  for (const p of latestPrices ?? []) {
    if (!latestPriceMap.has(p.security_id)) latestPriceMap.set(p.security_id, p.value)
  }

  const allHoldings = buildHoldings((allPortTxns ?? []) as never)
  const enriched = enrichHoldings(allHoldings, latestPriceMap)

  const totalCurrentValue = enriched.reduce((s, h) => s + (h.currentValue ?? h.costBasis), 0)
  const totalCostBasis    = enriched.reduce((s, h) => s + h.costBasis, 0)
  const totalGain         = totalCurrentValue - totalCostBasis
  const gainPct           = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0
  const isPositive        = totalGain >= 0

  // Per-asset-class breakdown
  const assetClassStats = portfolioList.map(p => {
    const txns = (allPortTxns ?? []).filter(t => t.portfolio_id === p.id)
    const hs = enrichHoldings(buildHoldings(txns as never), latestPriceMap)
    const val  = hs.reduce((s, h) => s + (h.currentValue ?? h.costBasis), 0)
    const cost = hs.reduce((s, h) => s + h.costBasis, 0)
    const pct  = cost > 0 ? ((val - cost) / cost) * 100 : 0
    return { id: p.id, name: p.name, asset_class: p.asset_class, value: val, cost, pct }
  }).filter(p => p.cost > 0)

  // For existing charts
  const allocData = allHoldings
    .filter(h => h.costBasis > 0)
    .map(h => ({ name: h.name, value: h.costBasis }))
    .sort((a, b) => b.value - a.value)

  const pnlData = enriched
    .map(h => h.gain != null ? { name: h.name, gain: h.gain, pct: h.gainPct ?? 0 } : null)
    .filter(Boolean) as { name: string; gain: number; pct: number }[]

  const hasData = totalCostBasis > 0

  return (
    <>
      {!accounts?.length && !portfolios?.length && <SampleDataBanner />}

      {/* ── Hero ── */}
      <div style={{
        background: hasData
          ? `linear-gradient(135deg, ${isPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)'}, transparent)`
          : 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)', borderRadius: 16,
        padding: '32px 36px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24,
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Your Portfolio is Worth
          </div>
          {hasData ? (<>
            <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {formatAmount(totalCurrentValue, baseCurrency)}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', borderRadius: 8, background: isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {isPositive ? '▲' : '▼'} {gainPct.toFixed(2)}%
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  ({isPositive ? '+' : ''}{formatAmount(totalGain, baseCurrency)})
                </span>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                from {formatAmount(totalCostBasis, baseCurrency)} invested
              </span>
            </div>
          </>) : (
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Add your first trade to see your portfolio value here.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <DashboardTradeButton />
          {hasData ? (
            <>
              <Link href="/portfolios" className="btn btn-secondary">Asset Classes</Link>
              <Link href="/holdings" className="btn btn-primary">Holdings</Link>
            </>
          ) : (
            <>
              <Link href="/portfolios/new" className="btn btn-secondary">Create Asset Class</Link>
              <Link href="/portfolios" className="btn btn-primary">Get Started →</Link>
            </>
          )}
        </div>
      </div>

      {/* ── Asset class strip ── */}
      {assetClassStats.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
          {assetClassStats.map(p => {
            const icon = ASSET_CLASS_ICONS[(p.asset_class as string) ?? 'EQUITY'] ?? '📊'
            return (
              <Link key={p.id} href={`/portfolios/${p.id}`} style={{
                minWidth: 160, padding: '14px 16px', borderRadius: 12,
                border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
                textDecoration: 'none', flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: 4,
                transition: 'border-color 0.2s',
              }}>
                <div style={{ fontSize: '1.2rem' }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>{p.name}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>{formatAmount(p.value, baseCurrency)}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: p.pct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {p.pct >= 0 ? '+' : ''}{p.pct.toFixed(1)}%
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── My Index Chart (TTWROR) ── */}
      {hasData && (
        <div className="mb-6">
          <MyIndexChart currency={baseCurrency} />
        </div>
      )}

      {/* ── Allocation / P&L charts ── */}
      {(allocData.length > 0 || pnlData.length > 0) && (
        <DashboardCharts
          priceHistory={[]}
          allocation={allocData}
          pnl={pnlData}
          currency={baseCurrency}
        />
      )}

      {/* ── Recent Trades ── */}
      <div className="card mt-6">
        <div className="card-header">
          <span className="card-title">Recent Trades</span>
          <Link href="/transactions" className="text-xs" style={{ color: 'var(--color-accent-light)' }}>View all</Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {!recentPortTxn?.length ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No trades yet</div>
              <Link href="/portfolios" className="btn btn-primary btn-sm mt-4">Go to Asset Classes to Trade</Link>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Security</th><th>Type</th><th>Asset Class</th><th className="table-right">Amount</th></tr></thead>
                <tbody>
                  {recentPortTxn.map(tx => {
                    const isBuy = ['BUY','DELIVERY_INBOUND','TRANSFER_IN'].includes(tx.type)
                    const typeLabel: Record<string, string> = {
                      BUY: 'Buy', SELL: 'Sell', DIVIDEND: 'Dividend', INTEREST: 'Interest',
                      DELIVERY_INBOUND: 'Buy (Delivery)', DELIVERY_OUTBOUND: 'Sell (Delivery)',
                      TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
                      BONUS: 'Bonus Shares', SPLIT: 'Stock Split',
                    }
                    return (
                      <tr key={tx.id}>
                        <td className="text-muted text-sm">{new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                        <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{(tx.securities as unknown as { name: string } | null)?.name ?? '—'}</td>
                        <td><span className={`badge ${isBuy ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '0.68rem' }}>{typeLabel[tx.type] ?? tx.type}</span></td>
                        <td className="text-sm text-muted">{(tx.portfolios as unknown as { name: string } | null)?.name ?? '—'}</td>
                        <td className="table-right text-sm">{formatAmount(tx.amount, tx.currency_code)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
