import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate } from '@/lib/format'
export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: securities } = await supabase
    .from('securities')
    .select('*, security_latest_prices(value, previous_close, date)')
    .order('name')

  const active = securities?.filter(s => !s.is_retired) ?? []
  const retired = securities?.filter(s => s.is_retired) ?? []

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Securities</h1>
          <p className="page-subtitle">{active.length} active · {retired.length} retired</p>
        </div>
        <Link href="/securities/new" className="btn btn-primary">+ Add Security</Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Ticker</th>
                <th>ISIN</th>
                <th>Currency</th>
                <th className="table-right">Latest Price</th>
                <th className="table-right">Change</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!securities?.length ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📈</div>
                      <div className="empty-state-title">No securities yet</div>
                      <div className="empty-state-text">Add your first security to start tracking your investments.</div>
                      <Link href="/securities/new" className="btn btn-primary mt-4">Add Security</Link>
                    </div>
                  </td>
                </tr>
              ) : (
                securities.map(s => {
                  const latest = (s.security_latest_prices as unknown as { value: number; previous_close: number | null; date: string } | null)
                  const change = latest?.previous_close
                    ? ((latest.value - latest.previous_close) / latest.previous_close) * 100
                    : null
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/securities/${s.id}`} style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>
                          {s.name}
                        </Link>
                        {s.note && <div className="text-xs text-muted truncate" style={{ maxWidth: 200 }}>{s.note}</div>}
                      </td>
                      <td className="font-mono text-sm">{s.ticker_symbol ?? '—'}</td>
                      <td className="font-mono text-sm text-muted">{s.isin ?? '—'}</td>
                      <td><span className="badge badge-blue">{s.currency_code}</span></td>
                      <td className="table-right font-mono text-sm">
                        {latest ? formatAmount(latest.value, s.currency_code) : '—'}
                      </td>
                      <td className={`table-right text-sm font-mono ${change === null ? '' : change >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                        {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${s.is_retired ? 'badge-gray' : 'badge-green'}`}>
                          {s.is_retired ? 'Retired' : 'Active'}
                        </span>
                      </td>
                      <td className="text-xs text-muted">{formatDate(s.updated_at)}</td>
                      <td>
                        <Link href={`/securities/${s.id}`} className="btn btn-icon btn-sm">→</Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
