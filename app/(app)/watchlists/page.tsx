import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import type { WatchlistSecurityItem } from '@/components/WatchlistCards'
export const dynamic = 'force-dynamic'

const WatchlistCards = dynamicImport(() => import('@/components/WatchlistCards'), { ssr: false })

export default async function WatchlistsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: watchlists }, { data: alerts }] = await Promise.all([
    supabase
      .from('watchlists')
      .select('*, watchlist_securities(security_id, sort_order, securities(id, name))')
      .order('sort_order'),
    supabase
      .from('watch_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  // Index alerts by security_id
  type AlertRow = { id: string; security_id: string; alert_type: string; threshold: number; note: string | null; is_active: boolean; triggered_at: string | null }
  const alertMap = new Map((alerts as AlertRow[] ?? []).map(a => [a.security_id, a]))

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Watchlists</h1>
          <p className="page-subtitle">Monitor securities and set price alerts</p>
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
        const securities = (wl.watchlist_securities as unknown as {
          security_id: string; sort_order: number;
          securities: { id: string; name: string } | null
        }[] ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .filter(s => s.securities != null)

        const items: WatchlistSecurityItem[] = securities.map(s => {
          const raw = alertMap.get(s.security_id) ?? null
          return {
            id: s.security_id,
            name: s.securities!.name,
            alert: raw ? {
              id: raw.id,
              alert_type: raw.alert_type as 'PRICE_ABOVE' | 'PRICE_BELOW' | 'CHANGE_PCT_UP' | 'CHANGE_PCT_DOWN',
              threshold: raw.threshold,
              note: raw.note,
              is_active: raw.is_active,
              triggered_at: raw.triggered_at,
            } : null,
          }
        })

        const alertCount = items.filter(i => i.alert?.is_active).length

        return (
          <div key={wl.id} className="card mb-6" style={{ padding: '16px 20px' }}>
            <div className="card-header" style={{ padding: '0 0 12px' }}>
              <span className="card-title">{wl.name}</span>
              <div className="flex flex-gap-2">
                <span className="badge badge-gray">{items.length} items</span>
                {alertCount > 0 && (
                  <span className="badge" style={{ background: '#f59e0b15', color: '#f59e0b', border: '1px solid #f59e0b40' }}>
                    🔔 {alertCount} alert{alertCount > 1 ? 's' : ''}
                  </span>
                )}
                <Link href={`/watchlists/${wl.id}/edit`} className="btn btn-icon btn-sm">✏️</Link>
              </div>
            </div>
            <WatchlistCards items={items} watchlistId={wl.id} />
          </div>
        )
      })}
    </>
  )
}
