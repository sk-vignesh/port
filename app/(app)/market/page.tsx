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

  // Latest trading date — uses only stable columns, no schema-cache risk
  const { data: dateRow } = await supabase
    .from('price_history')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const latestDate = dateRow?.date ?? null

  if (!latestDate) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Market</h1>
          <p className="page-subtitle">NSE EQ segment</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No price data yet</div>
            <div className="empty-state-text">
              Trigger the <strong>NSE EOD Price Fetch</strong> workflow in GitHub Actions to load market data.
            </div>
          </div>
        </div>
      </>
    )
  }

  // Progressive fallback — strip new columns if PostgREST schema cache is stale
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null = null
  let count: number | null = null
  let errMsg: string | null = null

  const attempts = [
    // 1. All columns + Nifty priority ordering (ideal)
    () => supabase.from('price_history')
      .select('symbol, name, close, prev_close, open, high, low, volume', { count: 'exact' })
      .eq('date', latestDate).order('index_priority', { ascending: true, nullsFirst: false }).order('symbol', { ascending: true }).range(0, 499),
    // 2. All columns + symbol ordering (index_priority not cached)
    () => supabase.from('price_history')
      .select('symbol, name, close, prev_close, open, high, low, volume', { count: 'exact' })
      .eq('date', latestDate).order('symbol', { ascending: true }).range(0, 499),
    // 3. Core columns only (name also not cached)
    () => supabase.from('price_history')
      .select('symbol, close, prev_close, open, high, low, volume', { count: 'exact' })
      .eq('date', latestDate).order('symbol', { ascending: true }).range(0, 499),
  ]

  for (const attempt of attempts) {
    const res = await attempt()
    if (!res.error) { data = res.data; count = res.count; break }
    errMsg = res.error.message
  }

  const initialRows = (data ?? []) as MarketRow[]
  const initialTotal = count ?? 0

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Market</h1>
        <p className="page-subtitle">NSE EQ segment · {fmtDate(latestDate)}</p>
      </div>

      {initialRows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No records for {fmtDate(latestDate)}</div>
            <div className="empty-state-text">
              {errMsg
                ? `Query error: ${errMsg}`
                : 'Re-run the NSE EOD Price Fetch workflow to reload market data.'}
            </div>
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
