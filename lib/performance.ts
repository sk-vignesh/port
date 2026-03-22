/**
 * Portfolio Performance Math Engine
 *
 * Implements the same algorithms as the Portfolio Performance desktop app:
 *   - True Time-Weighted Rate of Return (TTWROR)
 *   - Internal Rate of Return / Money-Weighted Return (IRR)
 *   - FIFO cost basis & P&L
 *   - Annualised return
 *
 * All monetary values are raw integers scaled by 100 (1 EUR = 100).
 * All share quantities are raw integers scaled by 100_000_000 (1 share = 100_000_000).
 * This matches the Supabase schema exactly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashFlow {
  date: Date
  amount: number  // positive = money received, negative = money paid out
}

export interface SubPeriod {
  /** Portfolio value at the START of this period (before any cash flow) */
  startValue: number
  /** Portfolio value at the END of this period (before the boundary cash flow) */
  endValue: number
}

export interface Holding {
  securityId: string
  name: string
  currency: string
  /** Raw shares × 100_000_000 */
  shares: number
  /** Raw cost basis × 100 (sum of buy amounts, adjusted for sells via avg-cost) */
  costBasis: number
}

export interface HoldingWithValue extends Holding {
  currentPrice: number | null   // latest price × 100
  currentValue: number | null   // market value × 100
  avgCostPerShare: number       // cost per share × 100
  gain: number | null           // unrealised P&L × 100
  gainPct: number | null        // fraction, e.g. 0.12 = 12%
}

export interface PerformanceResult {
  /** True Time-Weighted Rate of Return (chain-linked) */
  ttwror: number
  /** TTWROR annualised */
  ttwrorAnnualized: number
  /** Money-Weighted Return (IRR via Newton-Raphson); null if < 2 cash flows */
  irr: number | null
  /** Absolute gain = currentValue - investedCapital (× 100) */
  absoluteGain: number
  /** Total amount invested net of sells (× 100) */
  investedCapital: number
  /** Current market value of all holdings (× 100) */
  currentValue: number
  /** Holdings enriched with market value and gain */
  holdings: HoldingWithValue[]
  /** Start date of earliest transaction */
  since: string | null
  /** Years since first transaction */
  years: number
}

// ---------------------------------------------------------------------------
// Core math: TTWROR
// ---------------------------------------------------------------------------

/**
 * Chain-links sub-period returns to get True Time-Weighted Rate of Return.
 * Each SubPeriod represents the portfolio value at the start and end of a
 * period between two consecutive external cash flows.
 *
 * r_ttwror = ∏(endValue_i / startValue_i) − 1
 */
export function calcTTWROR(subPeriods: SubPeriod[]): number {
  if (subPeriods.length === 0) return 0
  let product = 1
  for (const { startValue, endValue } of subPeriods) {
    if (startValue === 0) continue
    product *= endValue / startValue
  }
  return product - 1
}

/**
 * Build sub-periods from a price timeline and transaction history.
 *
 * Algorithm:
 * 1. Sort price observations chronologically.
 * 2. For each consecutive pair of price dates, determine the share count
 *    held DURING that period (positionBefore = txs before the end date).
 * 3. Compute portfolio value at each date = shares × price.
 * 4. Each consecutive pair (date_i, date_{i+1}) forms one SubPeriod:
 *    - startValue = value at date_i
 *    - endValue   = value at date_{i+1}   (before any cash flow ON date_{i+1})
 *
 * @param priceSnapshots  Array of { date: string (YYYY-MM-DD), securityId, price }
 * @param transactions    Portfolio transactions sorted by date ascending
 */
export function buildSubPeriods(
  priceSnapshots: Array<{ date: string; securityId: string; price: number }>,
  transactions: Array<{ date: string; type: string; security_id: string; shares: number; amount: number }>
): SubPeriod[] {
  if (priceSnapshots.length < 2) return []

  // Group prices by date: Map<date, Map<securityId, price>>
  const pricesByDate = new Map<string, Map<string, number>>()
  for (const s of priceSnapshots) {
    if (!pricesByDate.has(s.date)) pricesByDate.set(s.date, new Map())
    pricesByDate.get(s.date)!.set(s.securityId, s.price)
  }

  const dates = [...pricesByDate.keys()].sort()

  // Calculate portfolio value on a given date using shares held up to (but not including) txs on that date
  function valueAt(date: string, inclusive: boolean): number {
    const prices = pricesByDate.get(date)
    if (!prices) return 0

    // Shares held: sum all txs BEFORE this date (or on this date if inclusive)
    const sharesMap = new Map<string, number>()
    for (const tx of transactions) {
      const txDate = tx.date.slice(0, 10)
      if (inclusive ? txDate <= date : txDate < date) {
        const isBuy = ['BUY', 'DELIVERY_INBOUND', 'TRANSFER_IN'].includes(tx.type)
        const isSell = ['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'].includes(tx.type)
        const cur = sharesMap.get(tx.security_id) ?? 0
        if (isBuy) sharesMap.set(tx.security_id, cur + tx.shares)
        else if (isSell) sharesMap.set(tx.security_id, cur - tx.shares)
      }
    }

    let total = 0
    for (const [secId, shares] of sharesMap) {
      const price = prices.get(secId)
      if (price != null && shares > 0) {
        total += Math.round((shares / 100_000_000) * price)
      }
    }
    return total
  }

  const subPeriods: SubPeriod[] = []
  for (let i = 0; i < dates.length - 1; i++) {
    const startDate = dates[i]
    const endDate   = dates[i + 1]

    // Start value: portfolio value at start date using shares held INCLUDING txs on that date
    const startValue = valueAt(startDate, true)
    // End value: portfolio value at end date using shares held BEFORE txs on that date
    const endValue   = valueAt(endDate, false)

    if (startValue > 0) {
      subPeriods.push({ startValue, endValue })
    }
  }

  return subPeriods
}

// ---------------------------------------------------------------------------
// Core math: IRR (Newton-Raphson)
// ---------------------------------------------------------------------------

/**
 * Calculate the Internal Rate of Return (money-weighted return) via Newton-Raphson.
 *
 * Convention:
 *   - Cash paid OUT (buys, deposits) → NEGATIVE amount
 *   - Cash received (sells, dividends, final portfolio value) → POSITIVE amount
 *
 * Returns the annual rate r such that:
 *   Σ CF_i / (1 + r)^t_i = 0     where t_i is years from first cash flow
 *
 * Returns null if there are fewer than 2 flows or if the solver doesn't converge.
 */
export function calcIRR(
  cashFlows: CashFlow[],
  maxIterations = 200,
  tolerance = 1e-8
): number | null {
  if (cashFlows.length < 2) return null

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = sorted[0].date.getTime()
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

  const flows = sorted.map(cf => ({
    t: (cf.date.getTime() - t0) / MS_PER_YEAR,
    v: cf.amount,
  }))

  const npv  = (r: number) => flows.reduce((s, f) => s + f.v / Math.pow(1 + r, f.t), 0)
  const dnpv = (r: number) => flows.reduce((s, f) => s - f.t * f.v / Math.pow(1 + r, f.t + 1), 0)

  // Try multiple starting points to avoid local traps
  for (const guess of [0.1, 0.0, 0.5, -0.1, 2.0]) {
    let rate = guess
    let converged = false
    for (let i = 0; i < maxIterations; i++) {
      const n  = npv(rate)
      const dn = dnpv(rate)
      if (Math.abs(dn) < 1e-14) break
      const next = rate - n / dn
      if (next <= -1) { rate = -0.9999; continue }
      if (Math.abs(next - rate) < tolerance) { rate = next; converged = true; break }
      rate = next
    }
    if (converged && isFinite(rate) && rate > -1) return rate
  }

  return null
}

// ---------------------------------------------------------------------------
// Core math: Annualised return
// ---------------------------------------------------------------------------

/** Convert a total return over `years` to an annualised rate. */
export function calcAnnualized(totalReturn: number, years: number): number {
  if (years <= 0 || !isFinite(totalReturn)) return totalReturn
  return Math.pow(1 + totalReturn, 1 / years) - 1
}

/** Years elapsed between two dates (fractional). */
export function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
}

// ---------------------------------------------------------------------------
// Holdings: FIFO / average-cost basis
// ---------------------------------------------------------------------------

type RawTx = {
  type: string
  security_id: string
  shares: number
  amount: number
  securities: { name: string; currency_code: string } | null
}

/**
 * Build holdings from portfolio transactions using the average-cost method
 * (same as Portfolio Performance's default "FIFO-average" approach).
 * Transactions must be sorted oldest-first.
 */
export function buildHoldings(transactions: RawTx[]): Holding[] {
  const map = new Map<string, Holding>()

  for (const tx of transactions) {
    if (!tx.security_id || !tx.securities) continue
    const sec = tx.securities

    const h = map.get(tx.security_id) ?? {
      securityId: tx.security_id,
      name: sec.name,
      currency: sec.currency_code,
      shares: 0,
      costBasis: 0,
    }

    const isBuy  = ['BUY', 'DELIVERY_INBOUND',  'TRANSFER_IN' ].includes(tx.type)
    const isSell = ['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'].includes(tx.type)

    if (isBuy) {
      h.shares    += tx.shares
      h.costBasis += tx.amount
    } else if (isSell && h.shares > 0) {
      // Release cost basis proportionally (average-cost)
      const fraction      = tx.shares / h.shares
      h.costBasis -= Math.round(h.costBasis * fraction)
      h.shares    -= tx.shares
    }

    map.set(tx.security_id, h)
  }

  return [...map.values()].filter(h => h.shares > 0)
}

// ---------------------------------------------------------------------------
// Holdings enrichment: add market value and gain
// ---------------------------------------------------------------------------

/**
 * Enrich holdings with current market value and unrealised gain/loss.
 * @param prices  Map<securityId, latestPrice × 100>
 */
export function enrichHoldings(
  holdings: Holding[],
  prices: Map<string, number>
): HoldingWithValue[] {
  return holdings.map(h => {
    const price        = prices.get(h.securityId) ?? null
    const shareCount   = h.shares / 100_000_000          // actual share count

    const currentValue = price != null
      ? Math.round(shareCount * price)
      : null

    const gain    = currentValue != null ? currentValue - h.costBasis : null
    const gainPct = gain != null && h.costBasis !== 0 ? gain / h.costBasis : null

    const avgCostPerShare = shareCount > 0
      ? Math.round(h.costBasis / shareCount)
      : 0

    return { ...h, currentPrice: price, currentValue, avgCostPerShare, gain, gainPct }
  })
}

// ---------------------------------------------------------------------------
// Convenience: sum current value from enriched holdings
// ---------------------------------------------------------------------------

export function totalCurrentValue(holdings: HoldingWithValue[]): number {
  return holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)
}

export function totalCostBasis(holdings: HoldingWithValue[]): number {
  return holdings.reduce((s, h) => s + h.costBasis, 0)
}
