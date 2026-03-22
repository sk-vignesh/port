/** Amounts are stored as BIGINT scaled x100. 1 EUR = 100 */
export const AMOUNT_SCALE = 100

/** Shares are stored as BIGINT scaled x100_000_000. 1 share = 100_000_000 */
export const SHARES_SCALE = 100_000_000

/** Convert stored long amount to display number (e.g. 10050 → 100.50) */
export function fromAmount(value: number): number {
  return value / AMOUNT_SCALE
}

/** Convert display number to stored long (e.g. 100.50 → 10050) */
export function toAmount(value: number): number {
  return Math.round(value * AMOUNT_SCALE)
}

/** Convert stored long shares to display number (e.g. 100_000_000 → 1.0) */
export function fromShares(value: number): number {
  return value / SHARES_SCALE
}

/** Convert display number to stored long shares */
export function toShares(value: number): number {
  return Math.round(value * SHARES_SCALE)
}

/** Format a stored amount for display */
export function formatAmount(value: number, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromAmount(value))
}

/** Format shares for display */
export function formatShares(value: number, decimals = 6): string {
  const n = fromShares(value)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n)
}

/** Format a percentage */
export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/** Calculate percentage change */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/** Format a date string to locale */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

/** Label map for account transaction types */
export const ACCOUNT_TX_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit',
  REMOVAL: 'Withdrawal',
  INTEREST: 'Interest',
  INTEREST_CHARGE: 'Interest Charge',
  DIVIDENDS: 'Dividends',
  FEES: 'Fees',
  FEES_REFUND: 'Fees Refund',
  TAXES: 'Taxes',
  TAX_REFUND: 'Tax Refund',
  BUY: 'Buy',
  SELL: 'Sell',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
}

/** Label map for portfolio transaction types */
export const PORTFOLIO_TX_LABELS: Record<string, string> = {
  BUY: 'Buy',
  SELL: 'Sell',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  DELIVERY_INBOUND: 'Delivery Inbound',
  DELIVERY_OUTBOUND: 'Delivery Outbound',
}

/** Badge CSS class by transaction type */
export function txBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    DEPOSIT: 'badge-green',
    INTEREST: 'badge-green',
    INTEREST_CHARGE: 'badge-red',
    DIVIDENDS: 'badge-blue',
    FEES: 'badge-red',
    FEES_REFUND: 'badge-green',
    TAXES: 'badge-red',
    TAX_REFUND: 'badge-green',
    REMOVAL: 'badge-red',
    BUY: 'badge-purple',
    SELL: 'badge-yellow',
    TRANSFER_IN: 'badge-blue',
    TRANSFER_OUT: 'badge-gray',
    DELIVERY_INBOUND: 'badge-blue',
    DELIVERY_OUTBOUND: 'badge-gray',
  }
  return classes[type] ?? 'badge-gray'
}
