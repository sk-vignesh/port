/**
 * Supabase Edge Function: price-search
 *
 * GET /functions/v1/price-search?q=Reliance
 *
 * Proxies Yahoo Finance autocomplete to avoid CORS issues from mobile.
 * No auth required (returns public market data only).
 */
import { handleCors, json } from '../_shared/cors.ts'

const EXCHANGE_CURRENCY: Record<string, string> = {
  NSE: 'INR', BSE: 'INR', BOM: 'INR',
  LSE: 'GBP', LON: 'GBP',
  ETR: 'EUR', FRA: 'EUR', PAR: 'EUR', AMS: 'EUR', MCE: 'EUR', MIL: 'EUR',
  TYO: 'JPY', TSX: 'CAD', ASX: 'AUD', VTX: 'CHF',
  STO: 'SEK', CPH: 'DKK', OSL: 'NOK',
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&enableFuzzyQuery=false`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!res.ok) return json([])

    const data    = await res.json()
    const quotes  = (data?.finance?.result?.[0]?.quotes ?? []) as Record<string, string>[]
    const TYPES   = new Set(['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY'])

    const results = quotes
      .filter(q => q.quoteType && TYPES.has(q.quoteType))
      .slice(0, 10)
      .map(q => ({
        symbol:   q.symbol,
        name:     q.longname || q.shortname || q.symbol,
        exchange: q.exchange,
        currency: q.currency ?? (EXCHANGE_CURRENCY[q.exchange] ?? 'USD'),
        type:     q.quoteType,
      }))

    return json(results)
  } catch {
    return json([])
  }
})
