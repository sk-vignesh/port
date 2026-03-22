import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamicImport from 'next/dynamic'
export const dynamic = 'force-dynamic'

const MarketGrid = dynamicImport(() => import('./MarketGrid'), { ssr: false })

export default async function MarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Just need the latest date — all data is fetched client-side via /api/market-data
  const { data: row } = await supabase
    .from('nse_market_data')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const latestDate = row?.date ?? null
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Market</h1>
        <p className="page-subtitle">
          NSE EQ segment{latestDate ? ` · ${fmtDate(latestDate)}` : ''}
        </p>
      </div>

      {!latestDate ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No price data yet</div>
            <div className="empty-state-text">End-of-day prices will appear here once they are available.</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '16px 20px' }}>
          <MarketGrid latestDate={latestDate} />
        </div>
      )}
    </>
  )
}
