import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatPercent } from '@/lib/format'
import { buildHoldings, enrichHoldings } from '@/lib/performance'
import dynamicImport from 'next/dynamic'
import type { HoldingRow } from '@/components/grids/HoldingsGrid'
export const dynamic = 'force-dynamic'

const HoldingsGrid = dynamicImport(() => import('@/components/grids/HoldingsGrid'), { ssr: false })

export default async function AllHoldingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('base_currency')
    .eq('user_id', user.id)
    .maybeSingle()

  const currency = settings?.base_currency ?? 'INR'

  // 1. All transactions across all active portfolios
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('is_retired', false)
    .order('name')

  const portfolioIds = (portfolios ?? []).map(p => p.id)

  const { data: allTxns } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(name, currency_code)')
    .in('portfolio_id', portfolioIds.length ? portfolioIds : ['00000000-0000-0000-0000-000000000000'])
    .order('date', { ascending: true })

  // 2. Build consolidated holdings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holdings = buildHoldings((allTxns ?? []) as any)

  // 3. Fetch latest prices for all held securities
  const securityIds = holdings.map(h => h.securityId)

  const { data: allPrices } = await supabase
    .from('security_prices')
    .select('security_id, value')
    .in('security_id', securityIds.length ? securityIds : ['00000000-0000-0000-0000-000000000000'])
    .order('date', { ascending: true })   // ascending → last write = latest

  const priceMap = new Map<string, number>()
  for (const p of allPrices ?? []) {
    priceMap.set(p.security_id, p.value)
  }

  // 4. Enrich with market value
  const enriched = enrichHoldings(holdings, priceMap)
    .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))

  // 5. Summary
  const totalCost  = enriched.reduce((s, h) => s + h.costBasis, 0)
  const totalValue = enriched.reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const totalGain  = totalValue - totalCost
  const totalPct   = totalCost > 0 ? totalGain / totalCost : 0

  // 6. Map to HoldingRow type expected by HoldingsGrid
  const rows: HoldingRow[] = enriched.map(h => ({
    securityId:     h.securityId,
    name:           h.name,
    currency:       h.currency,
    shares:         h.shares,
    avgCostPerShare: h.avgCostPerShare,
    costBasis:      h.costBasis,
    currentValue:   h.currentValue,
    currentPrice:   h.currentPrice,
    gain:           h.gain,
    gainPct:        h.gainPct,
  }))

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">All Holdings</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Consolidated view across {(portfolios ?? []).length} portfolio{(portfolios ?? []).length !== 1 ? 's' : ''}
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
            {[
              { label: 'Current Value',   value: formatAmount(totalValue, currency) },
              { label: 'Invested',         value: formatAmount(totalCost,  currency) },
              { label: 'Abs. Gain / Loss', value: formatAmount(totalGain,  currency), color: totalGain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
              { label: 'Return %',         value: formatPercent(totalPct * 100),       color: totalPct  >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
              { label: 'Positions',        value: String(enriched.length) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: color ?? 'var(--color-text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings AG Grid */}
      {rows.length === 0 ? (
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
            <span className="card-title">Holdings ({rows.length})</span>
            <span className="text-sm text-muted">{(portfolios ?? []).length} portfolios consolidated</span>
          </div>
          <HoldingsGrid rows={rows} />
        </div>
      )}
    </>
  )
}
