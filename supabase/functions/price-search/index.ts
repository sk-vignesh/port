/**
 * Supabase Edge Function: price-search
 *
 * GET /functions/v1/price-search?q=Reliance
 *
 * Searches the price_history table for securities matching the query.
 * Returns distinct symbols with names. No auth required (public market data).
 */
import { handleCors, json } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return json([])

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const pattern = `%${q}%`

    const { data, error } = await supabase
      .from('price_history')
      .select('symbol, name, close, date')
      .or(`symbol.ilike.${pattern},name.ilike.${pattern}`)
      .order('date', { ascending: false })
      .limit(100)

    if (error || !data) return json([])

    // Dedupe — keep only the latest row per symbol
    const seen = new Set<string>()
    const results = data
      .filter((row: { symbol: string }) => {
        if (seen.has(row.symbol)) return false
        seen.add(row.symbol)
        return true
      })
      .slice(0, 10)
      .map((row: { symbol: string; name: string | null }) => ({
        symbol:   row.symbol,
        name:     row.name || row.symbol,
        exchange: 'NSE',
        currency: 'INR',
        type:     'EQUITY',
      }))

    return json(results)
  } catch {
    return json([])
  }
})
