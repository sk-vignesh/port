/**
 * Fixed Income / FD math utilities
 *
 * Implements compound interest formulas used in Indian retail fixed deposits.
 * All monetary inputs/outputs use BIGINT × 100 encoding (₹1 = 100).
 * Rate inputs are plain percentages (7.5 = 7.5% p.a.).
 *
 * Formula: A = P × (1 + r/n)^(n×t)
 *   P = principal, r = annual rate (decimal), n = compounding frequency, t = years
 */

export interface FDTransaction {
  /** Purchase date (ISO YYYY-MM-DD) */
  date: string
  /** Maturity date (ISO YYYY-MM-DD), null for open-ended instruments like PPF */
  maturity_date: string | null
  /** Principal in BIGINT×100 units (e.g. ₹1,00,000 → 10_000_000) */
  face_value: number | null
  /** Annual interest rate as a percentage, e.g. 7.5 for 7.5% p.a. */
  coupon_rate: number | null
  /** Payout/compounding frequency */
  interest_frequency:
    | 'MONTHLY'
    | 'QUARTERLY'
    | 'SEMI_ANNUAL'
    | 'ANNUAL'
    | 'AT_MATURITY'
    | null
  /** Transaction type — only BUY rows carry FD math data */
  type: string
}

/** Compounding frequency → periods per year */
const FREQ_N: Record<string, number> = {
  MONTHLY:    12,
  QUARTERLY:   4,
  SEMI_ANNUAL: 2,
  ANNUAL:      1,
  AT_MATURITY: 1,
}

/** Exact day count between two ISO date strings (always non-negative safe) */
export function daysBetween(from: string, to: string): number {
  return Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
  )
}

/**
 * Days until maturity from today (negative = already matured).
 */
export function daysToMaturity(maturityDate: string): number {
  return daysBetween(new Date().toISOString().slice(0, 10), maturityDate)
}

/**
 * Current accrued value of an FD using compound interest model.
 *
 * Returns the value in BIGINT×100 units.
 * Falls back to face_value (principal) when rate or date are missing.
 *
 * Example: ₹1,00,000 at 7.5% quarterly for 1 year
 *   = 10_000_000 × (1 + 0.075/4)^4 ≈ 10_771_395
 */
export function fdAccruedValue(
  tx: FDTransaction,
  asOf = new Date().toISOString().slice(0, 10)
): number {
  const principal = tx.face_value ?? 0
  if (!principal || !tx.coupon_rate || tx.coupon_rate <= 0) return principal

  const days = daysBetween(tx.date, asOf)
  if (days <= 0) return principal

  const n     = FREQ_N[tx.interest_frequency ?? 'AT_MATURITY'] ?? 1
  const r     = tx.coupon_rate / 100
  const years = days / 365

  return Math.round(principal * Math.pow(1 + r / n, n * years))
}

/**
 * Projected total value at maturity using compound interest.
 *
 * Returns the value in BIGINT×100 units.
 */
export function fdMaturityValue(tx: FDTransaction): number {
  const principal = tx.face_value ?? 0
  if (!principal || !tx.coupon_rate || !tx.maturity_date) return principal

  const years = daysBetween(tx.date, tx.maturity_date) / 365
  if (years <= 0) return principal

  const n = FREQ_N[tx.interest_frequency ?? 'AT_MATURITY'] ?? 1
  const r = tx.coupon_rate / 100

  return Math.round(principal * Math.pow(1 + r / n, n * years))
}

/**
 * Expected interest payout per period (e.g. per quarter for quarterly FDs).
 *
 * Returns the amount in BIGINT×100 units.
 */
export function fdPeriodicInterest(tx: FDTransaction): number {
  const principal = tx.face_value ?? 0
  if (!principal || !tx.coupon_rate) return 0
  const n = FREQ_N[tx.interest_frequency ?? 'ANNUAL'] ?? 1
  return Math.round(principal * (tx.coupon_rate / 100) / n)
}

/**
 * Elapsed fraction of the FD term (0–1 clamped).
 * Returns 0 if start date or maturity date not available.
 */
export function fdElapsedFraction(tx: FDTransaction): number {
  if (!tx.maturity_date) return 0
  const today = new Date().toISOString().slice(0, 10)
  const total   = daysBetween(tx.date, tx.maturity_date)
  const elapsed = daysBetween(tx.date, today)
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, elapsed / total))
}
