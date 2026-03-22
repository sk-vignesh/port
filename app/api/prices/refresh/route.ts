import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * GET /api/prices/refresh
 *
 * Prices are now sourced from NSE via the Python script in scripts/fetch_nse_prices.py,
 * which runs automatically at 00:30 UTC Mon–Fri via GitHub Actions.
 *
 * This endpoint is kept for informational purposes — it returns the last known
 * price fetch date for each security so the UI can show a "last updated" indicator.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const singleId = searchParams.get('security_id')

  let query = supabase
    .from('security_latest_prices')
    .select('security_id, value, previous_close')

  if (singleId) query = (query as typeof query).eq('security_id', singleId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    source: 'NSE bhav copy (updated nightly at 00:30 UTC via GitHub Actions)',
    prices: (data ?? []).map(p => ({
      security_id:    p.security_id,
      current_price:  p.value ? p.value / 100 : null,
      previous_close: p.previous_close ? p.previous_close / 100 : null,
    })),
  })
}
