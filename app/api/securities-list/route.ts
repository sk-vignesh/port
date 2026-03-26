/**
 * GET /api/securities-list
 *
 * Returns all distinct (symbol, name) pairs from price_history.
 * ~5000 rows, ~200KB — designed to be fetched once on page load and cached
 * client-side for instant search filtering.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

let cache: { data: { symbol: string; name: string }[]; ts: number } | null = null
const TTL = 1000 * 60 * 60 // 1 hour

export async function GET() {
  // Serve from memory cache if still fresh
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const supabase = await createClient()

    // Get the latest row per symbol (name comes from most recent bhavcopy)
    const { data } = await supabase
      .from('price_history')
      .select('symbol, name')
      .not('name', 'is', null)
      .order('date', { ascending: false })
      .limit(10000)

    if (!data) return NextResponse.json([])

    // Dedupe — keep first (latest) occurrence of each symbol
    const seen = new Set<string>()
    const list = data
      .filter(row => {
        if (!row.name || seen.has(row.symbol)) return false
        seen.add(row.symbol)
        return true
      })
      .map(row => ({ symbol: row.symbol, name: row.name! }))

    cache = { data: list, ts: Date.now() }
    return NextResponse.json(list)
  } catch {
    return NextResponse.json([])
  }
}
