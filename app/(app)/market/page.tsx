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

  // Find the most recent date we have data for
  const { data: latestDateRow } = await supabase
    .from('nse_market_data')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const latestDate = latestDateRow?.date ?? null

  const { data: rows } = latestDate
    ? await supabase
        .from('nse_market_data')
        .select('symbol, close_price, prev_close, open_price, high_price, low_price, volume, isin')
        .eq('date', latestDate)
    : { data: [] }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

  // Compute change / % change server-side; sort by absolute % change
  const enriched: MarketRow[] = ((rows ?? []) as {
    symbol: string; close_price: number; prev_close: number | null
    open_price: number | null; high_price: number | null; low_price: number | null
    volume: number | null; isin: string | null
  }[]).map(r => {
    const chg = r.close_price != null && r.prev_close != null ? r.close_price - r.prev_close : null
    const pct = chg != null && r.prev_close ? (chg / r.prev_close) * 100 : null
    return { ...r, chg, pct }
  })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Market</h1>
        <p className="page-subtitle">
          NSE EQ segment{latestDate ? ` · ${fmtDate(latestDate)}` : ''}
        </p>
      </div>

      {!latestDate || enriched.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No price data yet</div>
            <div className="empty-state-text">End-of-day prices will appear here once they are available.</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '16px 20px' }}>
          <MarketGrid rows={enriched} />
        </div>
      )}
    </>
  )
}
