import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BUY_TYPES  = new Set(['BUY', 'DELIVERY_INBOUND',  'TRANSFER_IN'])
const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

/**
 * GET /api/gains
 * Computes per-security unrealised + realised P&L directly from the DB.
 * All monetary values are × 100 (paisa scale), shares × 100_000_000.
 * The gains page uses formatAmount() which divides by 100.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. All active portfolios
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id')
    .eq('is_retired', false)

  const portfolioIds = (portfolios ?? []).map(p => p.id)
  if (!portfolioIds.length) return NextResponse.json({ holdings: [], summary: null })

  // 2. All portfolio transactions (oldest first for avg-cost)
  const { data: allTxns, error: txErr } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(id, name, ticker_symbol, currency_code)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  if (txErr || !allTxns) return NextResponse.json({ error: txErr?.message ?? 'Failed' }, { status: 500 })

  // 3. Build holdings using avg-cost method
  type Holding = { securityId: string; name: string; currency: string; ticker: string | null; shares: number; costBasis: number }
  const holdingMap = new Map<string, Holding>()
  const realizedMap = new Map<string, number>()

  for (const tx of allTxns) {
    const sec = (tx.securities as unknown) as { id: string; name: string; ticker_symbol: string | null; currency_code: string } | null
    if (!tx.security_id || !sec) continue

    const h: Holding = holdingMap.get(tx.security_id) ?? {
      securityId: tx.security_id,
      name:       sec.name,
      currency:   sec.currency_code,
      ticker:     sec.ticker_symbol ?? null,
      shares:     0,
      costBasis:  0,
    }

    if (BUY_TYPES.has(tx.type)) {
      h.shares    += tx.shares ?? 0
      h.costBasis += tx.amount ?? 0
    } else if (SELL_TYPES.has(tx.type) && h.shares > 0) {
      const frac     = (tx.shares ?? 0) / h.shares
      const released = Math.round(h.costBasis * frac)
      const gain     = (tx.amount ?? 0) - released
      realizedMap.set(tx.security_id, (realizedMap.get(tx.security_id) ?? 0) + gain)
      h.costBasis   -= released
      h.shares      -= tx.shares ?? 0
    }

    holdingMap.set(tx.security_id, h)
  }

  // Keep only open positions
  const openHoldings = [...holdingMap.values()].filter(h => h.shares > 0)

  // 4. Tickers for price lookup
  const tickers = [...new Set(openHoldings.map(h => h.ticker).filter(Boolean) as string[])]

  const latestPriceByTicker = new Map<string, number>()
  if (tickers.length > 0) {
    const { data: prices } = await supabase
      .from('price_history')
      .select('symbol, date, close')
      .in('symbol', tickers)
      .order('date', { ascending: false })

    for (const p of prices ?? []) {
      if (!latestPriceByTicker.has(p.symbol))
        latestPriceByTicker.set(p.symbol, Math.round(Number(p.close) * 100)) // → paisa scale
    }
  }

  // 5. Build response rows
  const rows = openHoldings.map(h => {
    const shareCount     = h.shares / 100_000_000
    const latestPrice    = h.ticker ? (latestPriceByTicker.get(h.ticker) ?? null) : null
    const currentValue   = latestPrice != null ? Math.round(shareCount * latestPrice) : null
    const unrealizedGain = currentValue != null ? currentValue - h.costBasis : null
    const unrealizedPct  = unrealizedGain != null && h.costBasis > 0 ? unrealizedGain / h.costBasis : null
    const realizedGain   = realizedMap.get(h.securityId) ?? 0

    return {
      securityId:        h.securityId,
      name:              h.name,
      ticker:            h.ticker,
      currency:          h.currency,
      shares:            shareCount,
      avgCostPerShare:   shareCount > 0 ? h.costBasis / shareCount : 0,
      costBasis:         h.costBasis,
      currentPrice:      latestPrice,
      currentValue,
      unrealizedGain,
      unrealizedGainPct: unrealizedPct,
      realizedGain,
      totalGain:         (unrealizedGain ?? 0) + realizedGain,
    }
  })

  rows.sort((a, b) => Math.abs(b.totalGain) - Math.abs(a.totalGain))

  // 6. Summary
  const totalCost       = rows.reduce((s, r) => s + r.costBasis, 0)
  const totalValue      = rows.reduce((s, r) => s + (r.currentValue ?? 0), 0)
  const totalUnrealized = rows.reduce((s, r) => s + (r.unrealizedGain ?? 0), 0)
  const totalRealized   = rows.reduce((s, r) => s + r.realizedGain, 0)

  return NextResponse.json({
    holdings: rows,
    summary: {
      totalCost,
      totalValue,
      totalUnrealized,
      totalUnrealizedPct: totalCost > 0 ? totalUnrealized / totalCost : 0,
      totalRealized,
      totalGain:          totalUnrealized + totalRealized,
      positionsTotal:     rows.length,
      positionsWithPrice: rows.filter(r => r.currentPrice != null).length,
    },
  })
}
