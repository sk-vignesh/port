import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import type { MarketRow } from './MarketGrid'
export const dynamic = 'force-dynamic'

const MarketGrid = dynamicImport(() => import('./MarketGrid'), { ssr: false })

export default async function MarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Latest trading date
  const { data: dateRow } = await supabase
    .from('nse_market_data')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const latestDate = dateRow?.date ?? null

  // First 500 rows + total count — ordered by index priority then symbol
  const { data: rows, count } = latestDate
    ? await supabase
        .from('nse_market_data')
        .select('symbol, name, close_price, prev_close, open_price, high_price, low_price, volume', { count: 'exact' })
        .eq('date', latestDate)
        .order('index_priority', { ascending: true, nullsFirst: false })
        .order('symbol', { ascending: true })
        .range(0, 499)
    : { data: [], count: 0 }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

  const initialRows = (rows ?? []) as MarketRow[]
  const initialTotal = count ?? 0

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Market</h1>
        <p className="page-subtitle">
          NSE EQ segment{latestDate ? ` · ${fmtDate(latestDate)}` : ''}
        </p>
      </div>

      {!latestDate || initialRows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No price data yet</div>
            <div className="empty-state-text">End-of-day prices will appear here once they are available.</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '16px 20px' }}>
          <MarketGrid initialRows={initialRows} latestDate={latestDate} initialTotal={initialTotal} />
        </div>
      )}
    </>
  )
}
