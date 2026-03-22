import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate } from '@/lib/format'
export const dynamic = 'force-dynamic'

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
          securities: { id: string; name: string; currency_code: string; ticker_symbol: string | null;
            security_latest_prices: { value: number; previous_close: number | null } | null } | null
        }[] ?? []).sort((a, b) => a.sort_order - b.sort_order)

        return (
          <div key={wl.id} className="card mb-6">
            <div className="card-header">
              <span className="card-title">{wl.name}</span>
              <div className="flex flex-gap-2">
                <span className="badge badge-gray">{items.length} items</span>
                <Link href={`/watchlists/${wl.id}/edit`} className="btn btn-icon btn-sm">✏️</Link>
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Security</th>
                    <th>Ticker</th>
                    <th>Currency</th>
                    <th className="table-right">Price</th>
                    <th className="table-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {!items.length ? (
                    <tr><td colSpan={5}><div className="empty-state" style={{ padding: 24 }}>
                      <div className="empty-state-text">Watchlist is empty — add securities</div>
                    </div></td></tr>
                  ) : items.map(item => {
                    const sec = item.securities
                    if (!sec) return null
                    const lp = sec.security_latest_prices
                    const change = lp?.previous_close
                      ? ((lp.value - lp.previous_close) / lp.previous_close) * 100 : null
                    return (
                      <tr key={item.security_id}>
                        <td>
                          <Link href={`/securities/${sec.id}`} style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>
                            {sec.name}
                          </Link>
                        </td>
                        <td className="font-mono text-sm">{sec.ticker_symbol ?? '—'}</td>
                        <td><span className="badge badge-blue">{sec.currency_code}</span></td>
                        <td className="table-right font-mono text-sm">
                          {lp ? formatAmount(lp.value, sec.currency_code) : '—'}
                        </td>
                        <td className={`table-right text-sm font-mono ${change === null ? '' : change >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                          {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
