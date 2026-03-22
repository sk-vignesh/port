import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * Proxies searches to Yahoo Finance autocomplete API.
 * GET /api/prices/search?q=Apple
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&enableFuzzyQuery=false`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json([])
    const json = await res.json()
    const quotes = (json?.finance?.result?.[0]?.quotes ?? []) as Record<string, string>[]

    const results = quotes
      .filter(q => q.quoteType && ['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY'].includes(q.quoteType))
      .slice(0, 10)
      .map(q => ({
        symbol:    q.symbol,
        name:      q.longname || q.shortname || q.symbol,
        exchange:  q.exchange,
        currency:  q.currency ?? deriveCurrency(q.exchange),
        type:      q.quoteType,
      }))

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}

/** Best-guess currency from exchange code when Yahoo doesn't supply it */
function deriveCurrency(exchange?: string): string {
  const map: Record<string, string> = {
    NSE: 'INR', BSE: 'INR', BOM: 'INR',
    LSE: 'GBP', LON: 'GBP',
    ETR: 'EUR', FRA: 'EUR', PAR: 'EUR', AMS: 'EUR', MCE: 'EUR', MIL: 'EUR',
    TYO: 'JPY',
    TSX: 'CAD',
    ASX: 'AUD',
    VTX: 'CHF',
    STO: 'SEK',
    CPH: 'DKK',
    OSL: 'NOK',
  }
  return map[exchange ?? ''] ?? 'USD'
}
