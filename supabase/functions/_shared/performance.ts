/**
 * Portfolio Performance Math — Deno-compatible port of lib/performance.ts
 * Used by Edge Functions (gains, personal-index).
 *
 * All monetary values × 100, share quantities × 100_000_000 (matching schema).
 */

export interface Holding {
  securityId: string
  name: string
  currency: string
  shares: number    // raw × 100_000_000
  costBasis: number // raw × 100
}

type RawTx = {
  type: string
  security_id: string
  shares: number
  amount: number
  securities: { name: string; currency_code: string } | null
}

const BUY_TYPES  = new Set(['BUY', 'DELIVERY_INBOUND',  'TRANSFER_IN'])
const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

/**
 * Build current holdings using the average-cost method.
 * Transactions must be sorted oldest-first.
 */
export function buildHoldings(transactions: RawTx[]): Holding[] {
  const map = new Map<string, Holding>()

  for (const tx of transactions) {
    if (!tx.security_id || !tx.securities) continue

    const h = map.get(tx.security_id) ?? {
      securityId: tx.security_id,
      name:       tx.securities.name,
      currency:   tx.securities.currency_code,
      shares:     0,
      costBasis:  0,
    }

    if (BUY_TYPES.has(tx.type)) {
      h.shares    += tx.shares
      h.costBasis += tx.amount
    } else if (SELL_TYPES.has(tx.type) && h.shares > 0) {
      const fraction = tx.shares / h.shares
      h.costBasis   -= Math.round(h.costBasis * fraction)
      h.shares      -= tx.shares
    }

    map.set(tx.security_id, h)
  }

  return [...map.values()].filter(h => h.shares > 0)
}

export { BUY_TYPES, SELL_TYPES }
