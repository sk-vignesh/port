import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { buildHoldings, enrichHoldings } from '@/lib/performance'
import HoldingsClient from './HoldingsClient'
import type { HoldingRowWithClass } from './HoldingsClient'
export const dynamic = 'force-dynamic'

export default async function AllHoldingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings').select('base_currency').eq('user_id', user.id).maybeSingle()
  const currency = settings?.base_currency ?? 'INR'

  // Fetch all active portfolios with asset_class
  const { data: portfoliosRaw } = await supabase
    .from('portfolios').select('id, name, is_retired, asset_class')
    .eq('is_retired', false).order('name')

  type Portfolio = { id: string; name: string; is_retired: boolean; asset_class: string }
  const portfolios = (portfoliosRaw as unknown as Portfolio[] | null) ?? []
  const portfolioIds = portfolios.map(p => p.id)

  if (!portfolioIds.length) {
    return (
      <HoldingsClient
        groups={[]} totalValue={0} totalCost={0} totalGain={0} totalPct={0} currency={currency}
      />
    )
  }

  const { data: allTxns } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(id, name, currency_code)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  const allSecIds = [...new Set(
    (allTxns ?? []).map(t => (t.securities as unknown as { id: string } | null)?.id).filter(Boolean)
  )] as string[]

  const { data: allPrices } = await supabase
    .from('security_prices').select('security_id, value')
    .in('security_id', allSecIds.length ? allSecIds : ['00000000-0000-0000-0000-000000000000'])
    .order('date', { ascending: false })

  const priceMap = new Map<string, number>()
  for (const p of allPrices ?? []) {
    if (!priceMap.has(p.security_id)) priceMap.set(p.security_id, p.value)
  }

  // Build groups per portfolio
  interface AssetClassGroup {
    key: string; label: string; icon: string; portfolioId: string; rows: HoldingRowWithClass[]
    totalValue: number; totalCost: number; totalGain: number; gainPct: number
  }

  const ICONS: Record<string, string> = { EQUITY: '📈', COMMODITY: '🥇', FIXED_INCOME: '🏦', REAL_ESTATE: '🏠' }
  const LABELS: Record<string, string> = {
    EQUITY: 'Stocks & ETFs', COMMODITY: 'Commodities',
    FIXED_INCOME: 'Fixed Income', REAL_ESTATE: 'Real Estate',
  }

  const groups: AssetClassGroup[] = []
  for (const p of portfolios) {
    const txns = (allTxns ?? []).filter(t => t.portfolio_id === p.id)
    const holdings = buildHoldings(txns as never)
    const enriched = enrichHoldings(holdings, priceMap).filter(h => h.shares > 0)
    if (!enriched.length) continue

    const ac = (p as Portfolio & { asset_class?: string | null }).asset_class ?? 'EQUITY'
    const rows: HoldingRowWithClass[] = enriched.map(h => ({
      securityId:      h.securityId,
      name:            h.name,
      currency:        h.currency,
      shares:          h.shares,
      avgCostPerShare: h.avgCostPerShare,
      costBasis:       h.costBasis,
      currentValue:    h.currentValue,
      currentPrice:    h.currentPrice,
      gain:            h.gain,
      gainPct:         h.gainPct,
      assetClass:      ac,
      portfolioName:   p.name,
      portfolioId:     p.id,
    }))

    const totalValue = rows.reduce((s, h) => s + (h.currentValue ?? h.costBasis), 0)
    const totalCost  = rows.reduce((s, h) => s + h.costBasis, 0)
    const totalGain  = totalValue - totalCost
    groups.push({
      key: p.id, label: LABELS[ac] ?? p.name,
      icon: ICONS[ac] ?? '📊', portfolioId: p.id, rows,
      totalValue, totalCost, totalGain,
      gainPct: totalCost > 0 ? totalGain / totalCost : 0,
    })
  }

  const totalValue = groups.reduce((s, g) => s + g.totalValue, 0)
  const totalCost  = groups.reduce((s, g) => s + g.totalCost, 0)
  const totalGain  = totalValue - totalCost
  const totalPct   = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  return (
    <HoldingsClient
      groups={groups} totalValue={totalValue} totalCost={totalCost}
      totalGain={totalGain} totalPct={totalPct} currency={currency}
    />
  )
}
