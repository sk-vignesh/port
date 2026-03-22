import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate, formatShares } from '@/lib/format'
export const dynamic = 'force-dynamic'

export default async function SecurityDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: security } = await supabase
    .from('securities')
    .select('*, security_latest_prices(*), security_events(*, date), security_prices(date, value)')
    .eq('id', id)
    .single()

  if (!security) notFound()

  const prices = (security.security_prices as unknown as { date: string; value: number }[] ?? []).slice(-60).reverse()
  const events = (security.security_events as unknown as { id: string; date: string; type: string; details: Record<string, unknown> }[] ?? []).sort((a, b) => b.date.localeCompare(a.date))
  const latest = security.security_latest_prices as unknown as { value: number; previous_close: number | null; date: string; high: number | null; low: number | null } | null

  const change = latest?.previous_close
    ? ((latest.value - latest.previous_close) / latest.previous_close) * 100
    : null

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/securities" style={{ color: 'var(--color-accent-light)' }}>Securities</Link>
            {' / '}
            <span>{security.name}</span>
          </div>
          <h1 className="page-title">{security.name}</h1>
          <div className="flex flex-gap-2 mt-2">
            {security.ticker_symbol && <span className="badge badge-blue">{security.ticker_symbol}</span>}
            {security.isin && <span className="badge badge-gray font-mono">{security.isin}</span>}
            {security.wkn && <span className="badge badge-gray font-mono">{security.wkn}</span>}
            <span className="badge badge-purple">{security.currency_code}</span>
            {security.is_retired && <span className="badge badge-gray">Retired</span>}
          </div>
        </div>
        <div className="flex flex-gap-3 items-center">
          {latest && (
            <div className="text-right">
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {formatAmount(latest.value, security.currency_code)}
              </div>
              {change !== null && (
                <div className={`text-sm font-mono ${change >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                </div>
              )}
              <div className="text-xs text-muted">{formatDate(latest.date)}</div>
            </div>
          )}
          <Link href={`/securities/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      {/* Price stats */}
      {latest && (
        <div className="grid-4 mb-6">
          {[
            { label: 'Current', value: formatAmount(latest.value, security.currency_code) },
            { label: 'High', value: latest.high ? formatAmount(latest.high, security.currency_code) : '—' },
            { label: 'Low', value: latest.low ? formatAmount(latest.low, security.currency_code) : '—' },
            { label: 'Prev. Close', value: latest.previous_close ? formatAmount(latest.previous_close, security.currency_code) : '—' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ fontSize: '1.1rem' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        {/* Price History */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Price History (last 60)</span>
            <Link href={`/securities/${id}/prices`} className="text-xs" style={{ color: 'var(--color-accent-light)' }}>Manage prices</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!prices.length ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-text">No price history yet</div>
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Date</th><th className="table-right">Price</th></tr></thead>
                  <tbody>
                    {prices.map(p => (
                      <tr key={p.date}>
                        <td className="text-sm text-muted">{formatDate(p.date)}</td>
                        <td className="table-right font-mono text-sm">{formatAmount(p.value, security.currency_code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Events</span>
            <Link href={`/securities/${id}/events/new`} className="btn btn-secondary btn-sm">+ Event</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!events.length ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-text">No events (dividends, splits)</div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th>Details</th></tr></thead>
                  <tbody>
                    {events.map(ev => (
                      <tr key={ev.id}>
                        <td className="text-sm text-muted">{formatDate(ev.date)}</td>
                        <td>
                          <span className={`badge ${ev.type === 'DIVIDEND' ? 'badge-green' : ev.type === 'SPLIT' ? 'badge-blue' : 'badge-gray'}`}>
                            {ev.type}
                          </span>
                        </td>
                        <td className="text-sm text-muted">{JSON.stringify(ev.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta info */}
      {security.note && (
        <div className="card mt-4">
          <div className="card-header"><span className="card-title">Notes</span></div>
          <div className="card-body">
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>{security.note}</p>
          </div>
        </div>
      )}
    </>
  )
}
