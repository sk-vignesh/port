/**
 * GET /api/price-search?q=Reliance
 *
 * Searches the `price_history` table for distinct securities matching the query.
 * Returns up to 10 unique symbols with their names.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    const supabase = await createClient()
    const pattern = `%${q}%`

    const { data } = await supabase
      .from('price_history')
      .select('symbol, name, close, date')
      .or(`symbol.ilike.${pattern},name.ilike.${pattern}`)
      .order('date', { ascending: false })
      .limit(100)

    if (!data) return NextResponse.json([])

    // Dedupe — keep only the latest row per symbol
    const seen = new Set<string>()
    const results = data
      .filter((row) => {
        if (seen.has(row.symbol)) return false
        seen.add(row.symbol)
        return true
      })
      .slice(0, 10)
      .map((row) => ({
        symbol:   row.symbol,
        name:     row.name || row.symbol,
        exchange: 'NSE',
        currency: 'INR',
        type:     'EQUITY',
      }))

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}
