import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Columns the client is allowed to sort by (must match DB column names)
const SORTABLE = new Set(['symbol', 'close_price', 'prev_close', 'open_price', 'high_price', 'low_price', 'volume'])

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const date     = searchParams.get('date') ?? ''
  const start    = parseInt(searchParams.get('start') ?? '0', 10)
  const end      = parseInt(searchParams.get('end')   ?? '99', 10)
  const search   = searchParams.get('search') ?? ''
  const sortCol  = searchParams.get('sortCol') ?? 'symbol'
  const sortDir  = searchParams.get('sortDir') === 'desc' ? false : true  // ascending = true

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = await createClient()

  let query = supabase
    .from('nse_market_data')
    .select('symbol, name, close_price, prev_close, open_price, high_price, low_price, volume', { count: 'exact' })
    .eq('date', date)
    .range(start, end)
    .order(SORTABLE.has(sortCol) ? sortCol : 'symbol', { ascending: sortDir })

  if (search.trim()) {
    query = query.ilike('symbol', `%${search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data ?? [], total: count ?? 0 })
}
