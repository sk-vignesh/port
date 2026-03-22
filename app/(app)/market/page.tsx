import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'

export default async function MarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Get the most recent date we have data for
  const { data: latestDateRow } = await supabase
    .from('nse_market_data')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const latestDate = latestDateRow?.date ?? null

  // Fetch all symbols for that date, sorted by absolute % change
  const { data: rows } = latestDate
    ? await supabase
        .from('nse_market_data')
        .select('symbol, close_price, prev_close, open_price, high_price, low_price, volume, isin')
        .eq('date', latestDate)
        .order('symbol')
    : { data: [] }

  const enriched = ((rows ?? []) as {
    symbol: string; close_price: number; prev_close: number | null;
    open_price: number | null; high_price: number | null; low_price: number | null;
    volume: number | null; isin: string | null
  }[]).map(r => {
    const chg = r.close_price !== null && r.prev_close !== null ? r.close_price - r.prev_close : null
    const pct = chg !== null && r.prev_close ? (chg / r.prev_close) * 100 : null
    return { ...r, chg, pct }
  }).sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))

  const fmtINR = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Market</h1>
          <p className="page-subtitle">
            NSE EQ segment · {enriched.length} securities
            {latestDate ? ` · ${fmtDate(latestDate)}` : ''}
          </p>
        </div>
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
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="table-right">Prev Close</th>
                  <th className="table-right">Open</th>
                  <th className="table-right">High</th>
                  <th className="table-right">Low</th>
                  <th className="table-right">Close</th>
                  <th className="table-right">Change</th>
                  <th className="table-right">% Change</th>
                  <th className="table-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map(r => {
                  const isUp = (r.chg ?? 0) > 0
                  const isDown = (r.chg ?? 0) < 0
                  const cls = isUp ? 'amount-positive' : isDown ? 'amount-negative' : ''
                  return (
                    <tr key={r.symbol}>
                      <td style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-accent-light)', letterSpacing: '0.02em' }}>
                        {r.symbol}
                      </td>
                      <td className="table-right text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {r.prev_close != null ? fmtINR(r.prev_close) : '—'}
                      </td>
                      <td className="table-right text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {r.open_price != null ? fmtINR(r.open_price) : '—'}
                      </td>
                      <td className="table-right text-sm amount-positive">
                        {r.high_price != null ? fmtINR(r.high_price) : '—'}
                      </td>
                      <td className="table-right text-sm amount-negative">
                        {r.low_price != null ? fmtINR(r.low_price) : '—'}
                      </td>
                      <td className="table-right text-sm" style={{ fontWeight: 600 }}>
                        {fmtINR(r.close_price)}
                      </td>
                      <td className={`table-right text-sm ${cls}`}>
                        {r.chg != null ? (r.chg >= 0 ? '+' : '') + fmtINR(r.chg) : '—'}
                      </td>
                      <td className={`table-right text-sm ${cls}`} style={{ fontWeight: 600 }}>
                        {r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(2)}%` : '—'}
                      </td>
                      <td className="table-right text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {r.volume != null ? r.volume.toLocaleString('en-IN') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{
            padding: '10px 20px', fontSize: '0.72rem', color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span>📡</span>
            <span>NSE EQ bhav copy · sorted by largest daily move · prices in INR</span>
          </div>
        </div>
      )}
    </>
  )
}
