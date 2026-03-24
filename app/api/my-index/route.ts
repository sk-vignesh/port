import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_INDEX = 100   // starting index value
const BUY_TYPES  = new Set(['BUY',  'DELIVERY_INBOUND',  'TRANSFER_IN'])
const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

/**
 * GET /api/my-index
 *
 * Computes a "personal index" using the Base-Value / Divisor method:
 *
 *   I₀ = 100  (base value on first trading day with all holdings priced)
 *   Divisor = V₀ / I₀
 *
 *   Each subsequent day:
 *     I_t = V_t / Divisor
 *
 *   On transaction days (cash IN for buys, cash OUT for sells):
 *     Divisor_new = (V_before + C) / I_before
 *     where C = net cash flow (buy amounts are +, sell proceeds are −)
 *
 * Returns:
 *   { points: [{date, value, portfolioValue}], base: 100, latestValue: number }
 *
 * Query params:
 *   days  — integer, how many calendar days to look back (default 365)
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '365', 10)

  // ── 1. Get all portfolio IDs ──────────────────────────────────────────────
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id')
    .eq('is_retired', false)

  const portfolioIds = (portfolios ?? []).map(p => p.id)
  if (!portfolioIds.length) return NextResponse.json({ points: [], base: BASE_INDEX })

  // ── 2. Fetch ALL transactions (oldest first for correct state building) ───
  const { data: allTxns } = await supabase
    .from('portfolio_transactions')
    .select('date, type, shares, amount, security_id, securities(ticker_symbol)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  if (!allTxns?.length) return NextResponse.json({ points: [], base: BASE_INDEX })

  // Build ticker map
  const tickerMap = new Map<string, string>()
  for (const t of allTxns) {
    const sec = t.securities as unknown as { ticker_symbol: string | null } | null
    const ticker = sec?.ticker_symbol?.replace(/\.(NS|BO|BSE)$/i, '').toUpperCase()
    if (t.security_id && ticker) tickerMap.set(t.security_id, ticker)
  }

  const allTickers = [...new Set(tickerMap.values())]
  const firstTxnDate = allTxns[0].date.slice(0, 10)
  const windowStart  = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  // We need prices from first txn date to build holdings correctly,
  // but only return index points from windowStart onwards
  const priceFrom = firstTxnDate < windowStart ? firstTxnDate : windowStart

  // ── 3. Fetch price history for all held tickers ───────────────────────────
  if (!allTickers.length) return NextResponse.json({ points: [], base: BASE_INDEX })

  const { data: priceRows } = await supabase
    .from('price_history')
    .select('symbol, date, close')
    .in('symbol', allTickers)
    .gte('date', priceFrom)
    .order('date', { ascending: true })

  // Build price map: date → symbol → close (actual ₹)
  const priceByDate = new Map<string, Map<string, number>>()
  for (const p of (priceRows ?? [])) {
    if (!priceByDate.has(p.date)) priceByDate.set(p.date, new Map())
    priceByDate.get(p.date)!.set(p.symbol, Number(p.close))
  }

  // All trading dates we have price data for
  const allDates = [...priceByDate.keys()].sort()

  // ── 4. Group transactions by date ─────────────────────────────────────────
  const txnsByDate = new Map<string, typeof allTxns>()
  for (const t of allTxns) {
    const d = t.date.slice(0, 10)
    if (!txnsByDate.has(d)) txnsByDate.set(d, [])
    txnsByDate.get(d)!.push(t)
  }

  // ── 5. Simulate portfolio day-by-day using the divisor method ─────────────
  // holdings: securityId → shares (actual, not scaled)
  const holdings = new Map<string, number>()
  // Last known price per ticker (carry-forward for missing days)
  const lastPrice = new Map<string, number>()

  let divisor: number | null = null
  let indexValue = BASE_INDEX

  const points: { date: string; value: number; portfolioValue: number }[] = []

  for (const date of allDates) {
    const prices    = priceByDate.get(date)!
    const dayTxns   = txnsByDate.get(date) ?? []

    // Update last-known price
    for (const [sym, price] of prices) lastPrice.set(sym, price)

    // ── a. Compute V_before (using today's prices, holdings from yesterday) ─
    let vBefore = 0
    for (const [secId, shares] of holdings) {
      const ticker = tickerMap.get(secId)
      const price  = ticker ? (prices.get(ticker) ?? lastPrice.get(ticker) ?? 0) : 0
      vBefore += shares * price
    }

    // ── b. Net cash flow from transactions today (actual ₹) ──────────────────
    //   BUY  = +cash deployed  (money comes IN to the portfolio)
    //   SELL = −proceeds       (money goes OUT of the portfolio as it's externalised)
    let cashFlow = 0
    for (const t of dayTxns) {
      const amt = (t.amount ?? 0) / 100   // stored ×100 → actual ₹
      if (BUY_TYPES.has(t.type))   cashFlow += amt
      if (SELL_TYPES.has(t.type))  cashFlow -= amt
    }

    // ── c. Adjust divisor for cash flow (BEFORE applying transactions) ───────
    if (divisor !== null && cashFlow !== 0) {
      const iBefore: number = vBefore / divisor
      divisor = (vBefore + cashFlow) / iBefore
    }

    // ── d. Apply transactions to holdings ────────────────────────────────────
    for (const t of dayTxns) {
      if (!t.security_id) continue
      const shares = (t.shares ?? 0) / 100_000_000   // stored ×1e8 → actual shares
      const curr   = holdings.get(t.security_id) ?? 0
      if (BUY_TYPES.has(t.type))  holdings.set(t.security_id, curr + shares)
      if (SELL_TYPES.has(t.type)) holdings.set(t.security_id, Math.max(0, curr - shares))
    }

    // ── e. Compute V_after ───────────────────────────────────────────────────
    let vAfter = 0
    for (const [secId, shares] of holdings) {
      const ticker = tickerMap.get(secId)
      const price  = ticker ? (prices.get(ticker) ?? lastPrice.get(ticker) ?? 0) : 0
      vAfter += shares * price
    }

    // ── f. Initialise divisor on first day we can value the portfolio ─────────
    if (divisor === null && vAfter > 0) {
      divisor = vAfter / BASE_INDEX
      indexValue = BASE_INDEX
    } else if (divisor !== null && divisor > 0) {
      indexValue = vAfter / divisor
    }

    // Only emit a point if we have a valid index and are within the requested window
    if (divisor !== null && date >= windowStart) {
      points.push({
        date,
        value:          Math.round(indexValue * 100) / 100,
        portfolioValue: Math.round(vAfter),
      })
    }
  }

  const latestValue = points.at(-1)?.value ?? BASE_INDEX

  return NextResponse.json({ points, base: BASE_INDEX, latestValue })
}
