/**
 * Supabase Edge Function: gains
 *
 * GET /functions/v1/gains
 *
 * Returns per-security gains (unrealised + realised P&L) for the
 * authenticated user's portfolio positions. Identical response shape to
 * the legacy Next.js /api/gains route.
 *
 * Auth: Bearer <supabase_jwt>  (RLS enforces user scoping automatically)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, json } from '../_shared/cors.ts'
import { buildHoldings } from '../_shared/performance.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  // ── 1. User's portfolios ────────────────────────────────────────────────────
  const { data: portfolios } = await supabase
    .from('portfolios').select('id').eq('is_retired', false)

  const portfolioIds = (portfolios ?? []).map((p: { id: string }) => p.id)
  if (!portfolioIds.length) return json({ holdings: [], summary: null })

  // ── 2. All portfolio transactions (oldest first for avg-cost) ───────────────
  const { data: allTxns, error: txErr } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(id, name, ticker_symbol, currency_code)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  if (txErr || !allTxns) return json({ error: txErr?.message ?? 'Failed' }, 500)

  // ── 3. Build current holdings ───────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const txForHoldings = allTxns.map((t: any) => ({
    type:        t.type,
    security_id: t.security_id,
    shares:      t.shares ?? 0,
    amount:      t.amount ?? 0,
    securities:  t.securities as { name: string; currency_code: string } | null,
  }))
  const holdings = buildHoldings(txForHoldings)

  // Ticker map: securityId → ticker_symbol
  const tickerMap = new Map<string, string>()
  // deno-lint-ignore no-explicit-any
  for (const tx of allTxns as any[]) {
    if (tx.securities?.id && tx.securities?.ticker_symbol)
      tickerMap.set(tx.securities.id, tx.securities.ticker_symbol)
  }

  // ── 4. Latest price per ticker from price_history ───────────────────────────
  const tickers = [
    ...new Set(
      holdings
        .map(h => tickerMap.get(h.securityId))
        .filter(Boolean) as string[]
    ),
  ]

  const latestPriceMap = new Map<string, number>()
  if (tickers.length > 0) {
    const { data: prices } = await supabase
      .from('price_history')
      .select('symbol, date, close')
      .in('symbol', tickers)
      .order('date', { ascending: false })

    // deno-lint-ignore no-explicit-any
    for (const p of (prices ?? []) as any[]) {
      if (!latestPriceMap.has(p.symbol))
        latestPriceMap.set(p.symbol, Math.round(Number(p.close) * 100))
    }
  }

  // ── 5. Realised P&L (average-cost release) ─────────────────────────────────
  const realizedMap    = new Map<string, number>()
  const runState        = new Map<string, { shares: number; costBasis: number }>()
  // Per-security cashflow series for XIRR (outflows = buys, inflows = sells)
  const cashflowMap    = new Map<string, Array<{ date: string; amount: number }>>()

  const BUY  = new Set(['BUY', 'DELIVERY_INBOUND',  'TRANSFER_IN'])
  const SELL = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

  // deno-lint-ignore no-explicit-any
  for (const tx of allTxns as any[]) {
    if (!tx.security_id) continue
    const s       = runState.get(tx.security_id) ?? { shares: 0, costBasis: 0 }
    const isBuy   = BUY.has(tx.type)
    const isSell  = SELL.has(tx.type)

    if (isBuy) {
      s.shares    += tx.shares ?? 0
      s.costBasis += tx.amount ?? 0
      // Record outflow (negative) for XIRR
      if (!cashflowMap.has(tx.security_id)) cashflowMap.set(tx.security_id, [])
      cashflowMap.get(tx.security_id)!.push({ date: tx.date, amount: -(tx.amount ?? 0) })
    } else if (isSell && s.shares > 0) {
      const frac        = (tx.shares ?? 0) / s.shares
      const released    = Math.round(s.costBasis * frac)
      const gain        = (tx.amount ?? 0) - released
      realizedMap.set(tx.security_id, (realizedMap.get(tx.security_id) ?? 0) + gain)
      s.costBasis -= released
      s.shares    -= tx.shares ?? 0
      // Record inflow (positive) for XIRR
      if (!cashflowMap.has(tx.security_id)) cashflowMap.set(tx.security_id, [])
      cashflowMap.get(tx.security_id)!.push({ date: tx.date, amount: tx.amount ?? 0 })
    }
    runState.set(tx.security_id, s)
  }

  // ── 5b. Inline XIRR (Newton-Raphson) ───────────────────────────────────────
  function _npv(rate: number, flows: Array<{ date: string; amount: number }>): number {
    const t0 = new Date(flows[0].date).getTime()
    return flows.reduce((sum, f) => {
      const d = (new Date(f.date).getTime() - t0) / 86_400_000 / 365
      return sum + f.amount / Math.pow(1 + rate, d)
    }, 0)
  }
  function _dnpv(rate: number, flows: Array<{ date: string; amount: number }>): number {
    const t0 = new Date(flows[0].date).getTime()
    return flows.reduce((sum, f) => {
      const d = (new Date(f.date).getTime() - t0) / 86_400_000 / 365
      return sum - (d * f.amount) / Math.pow(1 + rate, d + 1)
    }, 0)
  }
  function _xirr(flows: Array<{ date: string; amount: number }>): number | null {
    if (flows.length < 2) return null
    if (!flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0)) return null
    let r = 0.1
    for (let i = 0; i < 150; i++) {
      const f = _npv(r, flows), df = _dnpv(r, flows)
      if (Math.abs(df) < 1e-14) return null
      const next = r - f / df
      if (Math.abs(next - r) < 1e-8) return next
      r = Math.max(-0.9999, Math.min(100, next))
    }
    return null
  }
  function _cagr(start: number, end: number, startDate: string, endDate: string): number | null {
    if (start <= 0 || end <= 0) return null
    const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000 / 365
    if (years <= 0) return null
    return Math.pow(end / start, 1 / years) - 1
  }

  // ── 6. Build response ───────────────────────────────────────────────────────
  const rows = holdings.map(h => {
    const ticker         = tickerMap.get(h.securityId)
    const latestPrice    = ticker ? latestPriceMap.get(ticker) ?? null : null
    const shareCount     = h.shares / 100_000_000

    const currentValue   = latestPrice != null ? Math.round(shareCount * latestPrice) : null
    const unrealizedGain = currentValue != null ? currentValue - h.costBasis : null
    const unrealizedPct  = unrealizedGain != null && h.costBasis > 0
      ? unrealizedGain / h.costBasis : null
    const realizedGain   = realizedMap.get(h.securityId) ?? 0

    // XIRR: add current value as terminal inflow, then compute
    const flows = cashflowMap.get(h.securityId) ?? []
    const today = new Date().toISOString().slice(0, 10)
    let xirrVal: number | null = null
    let cagrVal: number | null = null
    if (currentValue != null && currentValue > 0 && flows.length > 0) {
      const terminalFlows = [...flows, { date: today, amount: currentValue }]
      xirrVal = _xirr(terminalFlows)
      const firstBuyDate = flows[0]?.date
      if (firstBuyDate) cagrVal = _cagr(h.costBasis, currentValue, firstBuyDate, today)
    }

    return {
      securityId:        h.securityId,
      name:              h.name,
      ticker:            ticker ?? null,
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
      xirr:              xirrVal,
      cagr:              cagrVal,
    }
  })

  rows.sort((a, b) => Math.abs(b.totalGain) - Math.abs(a.totalGain))

  // ── 7. Summary ──────────────────────────────────────────────────────────────
  const totalCost       = rows.reduce((s, r) => s + r.costBasis,         0)
  const totalValue      = rows.reduce((s, r) => s + (r.currentValue ?? 0), 0)
  const totalUnrealized = rows.reduce((s, r) => s + (r.unrealizedGain ?? 0), 0)
  const totalRealized   = rows.reduce((s, r) => s + r.realizedGain,      0)

  return json({
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
})
