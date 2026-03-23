import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import type { WatchlistRow } from '@/components/grids/WatchlistGrid'
export const dynamic = 'force-dynamic'

const WatchlistGrid = dynamicImport(() => import('@/components/grids/WatchlistGrid'), { ssr: false })

export default async function WatchlistsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: watchlists } = await supabase
    .from('watchlists')
    .select('*, watchlist_securities(security_id, sort_order, securities(id, name, currency_code, isin, ticker_symbol, security_latest_prices(*)))')
    .order('sort_order')

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Watchlists</h1>
          <p className="page-subtitle">Monitor securities of interest</p>
        </div>
        <Link href="/watchlists/new" className="btn btn-primary">+ New Watchlist</Link>
      </div>

      {!watchlists?.length ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <div className="empty-state-title">No watchlists yet</div>
            <div className="empty-state-text">Create a watchlist to track securities you want to monitor.</div>
            <Link href="/watchlists/new" className="btn btn-primary mt-4">Create Watchlist</Link>
          </div>
        </div>
      ) : watchlists.map(wl => {
        const items = (wl.watchlist_securities as unknown as {
          security_id: string; sort_order: number;
          securities: {
            id: string; name: string; currency_code: string; ticker_symbol: string | null
            security_latest_prices: { value: number; previous_close: number | null } | null
          } | null
        }[] ?? []).sort((a, b) => a.sort_order - b.sort_order)

        const rows: WatchlistRow[] = items
          .filter(item => item.securities != null)
          .map(item => {
            const sec = item.securities!
            const lp  = sec.security_latest_prices
            const change_pct = lp?.previous_close
              ? ((lp.value - lp.previous_close) / lp.previous_close) * 100
              : null
            return {
              id:         item.security_id,
              name:       sec.name,
              ticker:     sec.ticker_symbol,
              price:      lp?.value ?? null,
              change_pct,
            }
          })

        return (
          <div key={wl.id} className="card mb-6" style={{ padding: '16px 20px' }}>
            <div className="card-header" style={{ padding: '0 0 12px' }}>
              <span className="card-title">{wl.name}</span>
              <div className="flex flex-gap-2">
                <span className="badge badge-gray">{items.length} items</span>
                <Link href={`/watchlists/${wl.id}/edit`} className="btn btn-icon btn-sm">✏️</Link>
              </div>
            </div>
            {rows.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-text">Watchlist is empty — add securities</div>
              </div>
            ) : (
              <WatchlistGrid rows={rows} />
            )}
          </div>
        )
      })}
    </>
  )
}
