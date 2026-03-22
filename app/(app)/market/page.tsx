import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'

const fmtPrice = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)

const fmtPct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export default async function MarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Securities this user owns
  const { data: securities } = await supabase
    .from('securities')
    .select('id, name, ticker_symbol')
    .eq('user_id', user.id)
    .eq('is_retired', false)
    .order('name')

  const secIds = securities?.map(s => s.id) ?? []

  // Latest prices + last date we have a price row for
  const [{ data: latestPrices }, { data: lastDates }] = await Promise.all([
    secIds.length > 0
      ? supabase.from('security_latest_prices').select('security_id, value, previous_close').in('security_id', secIds)
      : Promise.resolve({ data: [] }),
    secIds.length > 0
      ? supabase.from('security_prices').select('security_id, date').in('security_id', secIds).order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const priceMap = new Map((latestPrices ?? []).map(p => [p.security_id, p]))

  // Only want the most-recent date per security
  const dateMap = new Map<string, string>()
  for (const row of (lastDates ?? [])) {
    if (!dateMap.has(row.security_id)) dateMap.set(row.security_id, row.date)
  }

  const rows = (securities ?? []).map(sec => {
    const lp = priceMap.get(sec.id)
    const close = lp ? lp.value / 100 : null
    const prev  = lp?.previous_close ? lp.previous_close / 100 : null
    const chg   = close !== null && prev !== null ? close - prev : null
    const pct   = chg !== null && prev ? (chg / prev) * 100 : null
    const date  = dateMap.get(sec.id) ?? null
    return { ...sec, close, prev, chg, pct, date }
  }).sort((a, b) => {
    // Sort by absolute % change descending (most moved first), unknowns last
    const av = Math.abs(a.pct ?? -Infinity)
    const bv = Math.abs(b.pct ?? -Infinity)
    return bv - av
  })

  const hasAnyPrices = rows.some(r => r.close !== null)

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Market Prices</h1>
          <p className="page-subtitle">NSE end-of-day closing prices · updated nightly at 00:30 UTC</p>
        </div>
      </div>

      {!hasAnyPrices ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No price data yet</div>
            <div className="empty-state-text">
              Prices are fetched from NSE automatically at midnight UTC.<br />
              You can also trigger the GitHub Actions workflow manually to fetch immediately.
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Security</th>
                  <th className="table-right">Prev Close</th>
                  <th className="table-right">Last Close</th>
                  <th className="table-right">Change</th>
                  <th className="table-right">% Change</th>
                  <th className="table-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isUp   = (row.chg ?? 0) > 0
                  const isDown = (row.chg ?? 0) < 0
                  const chgClass = isUp ? 'amount-positive' : isDown ? 'amount-negative' : ''

                  return (
                    <tr key={row.id}>
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: '0.82rem',
                          color: 'var(--color-accent-light)',
                          letterSpacing: '0.02em',
                        }}>
                          {row.ticker_symbol ?? '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {row.name}
                      </td>
                      <td className="table-right text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {row.prev !== null ? fmtPrice(row.prev) : '—'}
                      </td>
                      <td className="table-right text-sm" style={{ fontWeight: 600 }}>
                        {row.close !== null ? fmtPrice(row.close) : '—'}
                      </td>
                      <td className={`table-right text-sm ${chgClass}`}>
                        {row.chg !== null ? (row.chg >= 0 ? '+' : '') + fmtPrice(row.chg) : '—'}
                      </td>
                      <td className={`table-right text-sm ${chgClass}`} style={{ fontWeight: 600 }}>
                        {row.pct !== null ? fmtPct(row.pct) : '—'}
                      </td>
                      <td className="table-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {row.date
                          ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{
            padding: '10px 20px', fontSize: '0.72rem', color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>📡</span>
            <span>Prices sourced from NSE bhav copy via nselib. Sorted by largest daily move.</span>
          </div>
        </div>
      )}
    </>
  )
}
