import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const RATE_LIMIT_HOURS = 2

/**
 * Yahoo Finance price fetcher — called manually or by the daily cron.
 *
 * GET /api/prices/refresh?security_id=xxx   — refresh single security
 * GET /api/prices/refresh                   — refresh all non-retired securities
 *
 * Rate-limited to once per 2 hours per security (enforced via latest price date).
 * The daily cron (Supabase pg_cron) calls this with no parameters to refresh all.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const singleId = searchParams.get('security_id')

  // Fetch securities to update
  let query = supabase.from('securities').select('id, name, ticker_symbol, currency_code').eq('is_retired', false)
  if (singleId) query = query.eq('id', singleId)
  const { data: securities, error: secErr } = await query
  if (secErr) return NextResponse.json({ error: secErr.message }, { status: 500 })
  if (!securities?.length) return NextResponse.json({ updated: 0, skipped: 0, errors: [] })

  // Check rate limit: get last price date per security
  const { data: lastPrices } = await supabase
    .from('security_prices')
    .select('security_id, date')
    .in('security_id', securities.map(s => s.id))
    .order('date', { ascending: false })

  const lastPriceDate = new Map<string, string>()
  for (const p of lastPrices ?? []) {
    if (!lastPriceDate.has(p.security_id)) lastPriceDate.set(p.security_id, p.date)
  }

  const cutoff = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000)
  const todayStr = new Date().toISOString().slice(0, 10)

  const results = { updated: 0, skipped: 0, errors: [] as string[] }

  for (const sec of securities) {
    if (!sec.ticker_symbol) { results.skipped++; continue }

    // Rate limit check — skip if we already have today's price AND last update < 2h ago
    const lastDate = lastPriceDate.get(sec.id)
    if (lastDate === todayStr && !singleId) { results.skipped++; continue }

    try {
      const price = await fetchYahooPrice(sec.ticker_symbol)
      if (!price) { results.errors.push(`${sec.ticker_symbol}: no price returned`); continue }

      // Upsert today's price
      const { error: upsertErr } = await supabase
        .from('security_prices')
        .upsert({ security_id: sec.id, date: todayStr, value: Math.round(price * 100) }, { onConflict: 'security_id,date' })

      if (upsertErr) {
        results.errors.push(`${sec.ticker_symbol}: ${upsertErr.message}`)
      } else {
        results.updated++
      }
      // Small delay to be polite to Yahoo
      await new Promise(r => setTimeout(r, 400))
    } catch (e) {
      results.errors.push(`${sec.ticker_symbol}: ${String(e)}`)
    }
  }

  return NextResponse.json(results)
}

/**
 * Fetch latest close price from Yahoo Finance's unofficial chart API.
 * Returns the price in the security's native currency (NOT scaled).
 */
async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const closes: number[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    // Get last non-null close
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) return closes[i]
    }
    return null
  } catch {
    return null
  }
}
