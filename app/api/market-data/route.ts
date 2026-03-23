import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Columns the client is allowed to sort by (must match DB column names)
const SORTABLE = new Set(['symbol', 'close_price', 'prev_close', 'open_price', 'high_price', 'low_price', 'volume'])
const SELECT = 'symbol, name, close_price, prev_close, open_price, high_price, low_price, volume'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const date    = searchParams.get('date') ?? ''
  const start   = parseInt(searchParams.get('start') ?? '0', 10)
  const end     = parseInt(searchParams.get('end')   ?? '99', 10)
  const search  = searchParams.get('search') ?? ''
  const sortCol = searchParams.get('sortCol') ?? ''
  const sortDir = searchParams.get('sortDir') === 'desc' ? false : true

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const supabase = await createClient()

  const buildQuery = (useIndexPriority: boolean) => {
    let q = supabase
      .from('nse_market_data')
      .select(SELECT, { count: 'exact' })
      .eq('date', date)
      .range(start, end)

    if (SORTABLE.has(sortCol)) {
      q = q.order(sortCol, { ascending: sortDir })
    } else if (useIndexPriority) {
      q = q.order('index_priority', { ascending: true, nullsFirst: false }).order('symbol', { ascending: true })
    } else {
      q = q.order('symbol', { ascending: true })
    }

    if (search.trim()) {
      q = q.ilike('symbol', `%${search.trim()}%`)
    }
    return q
  }

  let { data, count, error } = await buildQuery(true)

  // Schema cache fallback — if index_priority not yet known, retry without it
  if (error?.message?.includes('index_priority')) {
    const r2 = await buildQuery(false)
    data = r2.data; count = r2.count; error = r2.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data ?? [], total: count ?? 0 })
}
