/**
 * Supabase Edge Function: personal-index
 *
 * GET /functions/v1/personal-index?days=365
 *
 * Computes the user's personal portfolio index using the divisor-based method
 * (same maths as /api/my-index). Returns time-series points for charting.
 *
 * Auth: Bearer <supabase_jwt>
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, json } from '../_shared/cors.ts'

const BASE_INDEX = 100
const BUY_TYPES  = new Set(['BUY',  'DELIVERY_INBOUND',  'TRANSFER_IN'])
const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

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

  const url  = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '365', 10)

  // ── 1. Portfolio IDs ────────────────────────────────────────────────────────
  const { data: portfolios } = await supabase
    .from('portfolios').select('id').eq('is_retired', false)

  const portfolioIds = (portfolios ?? []).map((p: { id: string }) => p.id)
  if (!portfolioIds.length) return json({ points: [], base: BASE_INDEX })

  // ── 2. All transactions (oldest first) ─────────────────────────────────────
  const { data: allTxns } = await supabase
    .from('portfolio_transactions')
    .select('date, type, shares, amount, security_id, securities(ticker_symbol)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  if (!allTxns?.length) return json({ points: [], base: BASE_INDEX })

  // Ticker map
  const tickerMap = new Map<string, string>()
  // deno-lint-ignore no-explicit-any
  for (const t of allTxns as any[]) {
    const ticker = t.securities?.ticker_symbol
      ?.replace(/\.(NS|BO|BSE)$/i, '').toUpperCase()
    if (t.security_id && ticker) tickerMap.set(t.security_id, ticker)
  }

  const allTickers   = [...new Set(tickerMap.values())]
  const firstTxnDate = (allTxns[0] as { date: string }).date.slice(0, 10)
  const windowStart  = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const priceFrom    = firstTxnDate < windowStart ? firstTxnDate : windowStart

  // ── 3. Price history ────────────────────────────────────────────────────────
  if (!allTickers.length) return json({ points: [], base: BASE_INDEX })

  const { data: priceRows } = await supabase
    .from('price_history')
    .select('symbol, date, close')
    .in('symbol', allTickers)
    .gte('date', priceFrom)
    .order('date', { ascending: true })

  // priceByDate: date → symbol → close (actual ₹)
  const priceByDate = new Map<string, Map<string, number>>()
  // deno-lint-ignore no-explicit-any
  for (const p of (priceRows ?? []) as any[]) {
    if (!priceByDate.has(p.date)) priceByDate.set(p.date, new Map())
    priceByDate.get(p.date)!.set(p.symbol, Number(p.close))
  }

  const allDates = [...priceByDate.keys()].sort()

  // ── 4. Group transactions by date ───────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const txnsByDate = new Map<string, any[]>()
  // deno-lint-ignore no-explicit-any
  for (const t of allTxns as any[]) {
    const d = (t.date as string).slice(0, 10)
    if (!txnsByDate.has(d)) txnsByDate.set(d, [])
    txnsByDate.get(d)!.push(t)
  }

  // ── 5. Divisor-based simulation ─────────────────────────────────────────────
  const holdings  = new Map<string, number>()  // secId → actual shares
  const lastPrice = new Map<string, number>()  // ticker → last known ₹

  let divisor:    number | null = null
  let indexValue: number        = BASE_INDEX

  const points: { date: string; value: number; portfolioValue: number }[] = []

  for (const date of allDates) {
    const prices  = priceByDate.get(date)!
    const dayTxns = txnsByDate.get(date) ?? []

    for (const [sym, price] of prices) lastPrice.set(sym, price)

    // V_before
    let vBefore = 0
    for (const [secId, shares] of holdings) {
      const ticker = tickerMap.get(secId)
      const price  = ticker ? (prices.get(ticker) ?? lastPrice.get(ticker) ?? 0) : 0
      vBefore += shares * price
    }

    // Cash flow
    let cashFlow = 0
    // deno-lint-ignore no-explicit-any
    for (const t of dayTxns as any[]) {
      const amt = (t.amount ?? 0) / 100
      if (BUY_TYPES.has(t.type))  cashFlow += amt
      if (SELL_TYPES.has(t.type)) cashFlow -= amt
    }

    // Adjust divisor
    if (divisor !== null && cashFlow !== 0) {
      const iBefore: number = vBefore / divisor
      divisor = (vBefore + cashFlow) / iBefore
    }

    // Apply transactions
    // deno-lint-ignore no-explicit-any
    for (const t of dayTxns as any[]) {
      if (!t.security_id) continue
      const shares = (t.shares ?? 0) / 100_000_000
      const curr   = holdings.get(t.security_id) ?? 0
      if (BUY_TYPES.has(t.type))  holdings.set(t.security_id, curr + shares)
      if (SELL_TYPES.has(t.type)) holdings.set(t.security_id, Math.max(0, curr - shares))
    }

    // V_after
    let vAfter = 0
    for (const [secId, shares] of holdings) {
      const ticker = tickerMap.get(secId)
      const price  = ticker ? (prices.get(ticker) ?? lastPrice.get(ticker) ?? 0) : 0
      vAfter += shares * price
    }

    if (divisor === null && vAfter > 0) {
      divisor    = vAfter / BASE_INDEX
      indexValue = BASE_INDEX
    } else if (divisor !== null && divisor > 0) {
      indexValue = vAfter / divisor
    }

    if (divisor !== null && date >= windowStart) {
      points.push({
        date,
        value:          Math.round(indexValue * 100) / 100,
        portfolioValue: Math.round(vAfter),
      })
    }
  }

  const latestValue = points.at(-1)?.value ?? BASE_INDEX
  return json({ points, base: BASE_INDEX, latestValue })
})
