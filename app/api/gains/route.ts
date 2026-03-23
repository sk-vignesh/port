import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildHoldings } from '@/lib/performance'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gains
 *
 * Returns per-security gains table:
 *   - Current holdings (FIFO cost basis from portfolio_transactions)
 *   - Latest price from price_history (matched via securities.ticker_symbol)
 *   - Unrealised P&L = currentValue - costBasis
 *   - Realized P&L from sell transactions (proceeds - released cost basis)
 *
 * Also returns portfolio-level summary totals.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. Get user's portfolios ───────────────────────────────────────────
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id')
    .eq('is_retired', false)

  const portfolioIds = (portfolios ?? []).map(p => p.id)
  if (portfolioIds.length === 0) {
    return NextResponse.json({ holdings: [], summary: null })
  }

  // ── 2. All portfolio transactions (oldest first for FIFO) ──────────────
  const { data: allTxns, error: txErr } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(id, name, ticker_symbol, currency_code)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  if (txErr || !allTxns) {
    return NextResponse.json({ error: txErr?.message ?? 'Failed to fetch transactions' }, { status: 500 })
  }

  // ── 3. Build current holdings (FIFO average cost) ─────────────────────
  // Adapt txns to the format buildHoldings() expects
  const txForHoldings = allTxns.map(t => ({
    type:        t.type,
    security_id: t.security_id,
    shares:      t.shares ?? 0,
    amount:      t.amount ?? 0,
    securities:  t.securities as unknown as { name: string; currency_code: string } | null,
  }))
  const holdings = buildHoldings(txForHoldings)

  // Map security_id → ticker_symbol
  const tickerMap = new Map<string, string>()
  for (const tx of allTxns) {
    const sec = tx.securities as unknown as { id: string; ticker_symbol: string | null } | null
    if (sec?.id && sec.ticker_symbol) tickerMap.set(sec.id, sec.ticker_symbol)
  }

  // ── 4. Fetch latest price per ticker from price_history ───────────────
  const tickers = [...new Set(
    holdings
      .map(h => tickerMap.get(h.securityId))
      .filter(Boolean) as string[]
  )]

  // Get the most recent close price for each symbol
  const latestPriceMap = new Map<string, number>()  // ticker → price × 100

  if (tickers.length > 0) {
    // Use a single query: get max date per symbol then join
    const { data: prices } = await supabase
      .from('price_history')
      .select('symbol, date, close')
      .in('symbol', tickers)
      .order('date', { ascending: false })

    // First occurrence per symbol = most recent (since ordered desc)
    for (const p of (prices ?? [])) {
      if (!latestPriceMap.has(p.symbol)) {
        // price_history.close is in actual rupees (not ×100), so multiply by 100
        latestPriceMap.set(p.symbol, Math.round(Number(p.close) * 100))
      }
    }
  }

  // ── 5. Compute realized P&L from sell transactions ───────────────────
  // Track cost basis release per sell using running average-cost state
  const realizedMap = new Map<string, number>()   // securityId → realized gain × 100
  const runningState = new Map<string, { shares: number; costBasis: number }>()

  for (const tx of allTxns) {
    if (!tx.security_id) continue
    const s = runningState.get(tx.security_id) ?? { shares: 0, costBasis: 0 }
    const isBuy  = ['BUY', 'DELIVERY_INBOUND',  'TRANSFER_IN' ].includes(tx.type)
    const isSell = ['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'].includes(tx.type)

    if (isBuy) {
      s.shares    += tx.shares ?? 0
      s.costBasis += tx.amount ?? 0
    } else if (isSell && s.shares > 0) {
      const fraction = (tx.shares ?? 0) / s.shares
      const releasedCost = Math.round(s.costBasis * fraction)
      const proceeds     = tx.amount ?? 0
      const gain         = proceeds - releasedCost
      realizedMap.set(tx.security_id, (realizedMap.get(tx.security_id) ?? 0) + gain)
      s.costBasis -= releasedCost
      s.shares    -= tx.shares ?? 0
    }
    runningState.set(tx.security_id, s)
  }

  // ── 6. Build response rows ────────────────────────────────────────────
  const rows = holdings.map(h => {
    const ticker       = tickerMap.get(h.securityId)
    const latestPrice  = ticker ? latestPriceMap.get(ticker) ?? null : null
    const shareCount   = h.shares / 100_000_000

    const currentValue = latestPrice != null ? Math.round(shareCount * latestPrice) : null
    const unrealizedGain    = currentValue != null ? currentValue - h.costBasis : null
    const unrealizedGainPct = unrealizedGain != null && h.costBasis > 0
      ? unrealizedGain / h.costBasis
      : null
    const realizedGain = realizedMap.get(h.securityId) ?? 0

    return {
      securityId:       h.securityId,
      name:             h.name,
      ticker:           ticker ?? null,
      currency:         h.currency,
      shares:           shareCount,
      avgCostPerShare:  shareCount > 0 ? h.costBasis / shareCount : 0,   // × 100
      costBasis:        h.costBasis,
      currentPrice:     latestPrice,                                       // × 100
      currentValue,
      unrealizedGain,
      unrealizedGainPct,
      realizedGain,
      totalGain:        (unrealizedGain ?? 0) + realizedGain,
    }
  })

  // Sort by total absolute gain descending
  rows.sort((a, b) => Math.abs(b.totalGain) - Math.abs(a.totalGain))

  // ── 7. Summary ────────────────────────────────────────────────────────
  const totalCost        = rows.reduce((s, r) => s + r.costBasis,                 0)
  const totalValue       = rows.reduce((s, r) => s + (r.currentValue ?? 0),       0)
  const totalUnrealized  = rows.reduce((s, r) => s + (r.unrealizedGain ?? 0),     0)
  const totalRealized    = rows.reduce((s, r) => s + r.realizedGain,              0)
  const pricesCovered    = rows.filter(r => r.currentPrice != null).length

  return NextResponse.json({
    holdings: rows,
    summary: {
      totalCost,
      totalValue,
      totalUnrealized,
      totalUnrealizedPct: totalCost > 0 ? totalUnrealized / totalCost : 0,
      totalRealized,
      totalGain: totalUnrealized + totalRealized,
      positionsTotal:   rows.length,
      positionsWithPrice: pricesCovered,
    },
  })
}
