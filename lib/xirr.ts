/**
 * lib/xirr.ts — XIRR and CAGR calculation utilities
 *
 * XIRR: Extended Internal Rate of Return (Newton-Raphson, matches Excel XIRR exactly)
 * CAGR: Compound Annual Growth Rate
 *
 * All dates as ISO YYYY-MM-DD strings.
 * All monetary values in any consistent unit (BIGINT×100 works fine).
 */

export interface Cashflow {
  /** ISO YYYY-MM-DD */
  date:   string
  /** Negative = outflow (purchase), positive = inflow (sale / terminal value) */
  amount: number
}

/** Fractional days between two ISO date strings */
function daysFrom(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
}

/** NPV of cashflows at annual rate r, using first cashflow as time-zero */
function npv(rate: number, flows: Cashflow[]): number {
  const t0 = flows[0].date
  return flows.reduce(
    (sum, f) => sum + f.amount / Math.pow(1 + rate, daysFrom(t0, f.date) / 365),
    0
  )
}

/** Derivative of NPV with respect to rate */
function dnpv(rate: number, flows: Cashflow[]): number {
  const t0 = flows[0].date
  return flows.reduce((sum, f) => {
    const d = daysFrom(t0, f.date) / 365
    return sum - (d * f.amount) / Math.pow(1 + rate, d + 1)
  }, 0)
}

/**
 * Extended IRR (XIRR) via Newton-Raphson iteration.
 *
 * @param flows  Cashflow array — must have at least one negative and one positive value.
 * @param guess  Initial rate guess (default 0.10 = 10%)
 * @returns      Annualised rate as a decimal (e.g. 0.1547 = 15.47%), or null if no convergence.
 *
 * @example
 * xirr([{date:'2023-01-01', amount:-100_000_000}, {date:'2024-01-01', amount:115_000_000}])
 * // ≈ 0.15  (15%)
 */
export function xirr(flows: Cashflow[], guess = 0.1): number | null {
  if (flows.length < 2) return null

  // Require at least one negative (outflow) and one positive (inflow)
  const hasNeg = flows.some(f => f.amount < 0)
  const hasPos = flows.some(f => f.amount > 0)
  if (!hasNeg || !hasPos) return null

  let r = guess
  for (let i = 0; i < 150; i++) {
    const f  = npv(r, flows)
    const df = dnpv(r, flows)
    if (Math.abs(df) < 1e-14) return null    // flat derivative — bail out
    const next = r - f / df
    if (Math.abs(next - r) < 1e-8) return next
    // Clamp to avoid blow-up
    r = Math.max(-0.9999, Math.min(100, next))
  }
  return null   // Did not converge within 150 iterations
}

/**
 * Simple CAGR: (endValue / startValue)^(1 / years) − 1
 *
 * @returns Annualised rate as a decimal (e.g. 0.2247 = 22.47%), or null if insufficient data.
 *
 * @example
 * cagr(100_000_000, 150_000_000, '2022-01-01', '2024-01-01')
 * // ≈ 0.2247
 */
export function cagr(
  startValue: number,
  endValue:   number,
  startDate:  string,
  endDate:    string
): number | null {
  if (startValue <= 0 || endValue <= 0) return null
  const years = daysFrom(startDate, endDate) / 365
  if (years <= 0) return null
  return Math.pow(endValue / startValue, 1 / years) - 1
}
