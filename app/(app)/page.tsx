import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate } from '@/lib/format'
import { buildHoldings } from '@/lib/performance'
import SampleDataBanner from '@/components/SampleDataBanner'
import DashboardCharts from '@/components/DashboardCharts'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: securities },
    { data: accounts },
    { data: portfolios },
    { data: settings },
  ] = await Promise.all([
    supabase.from('securities').select('id, name, currency_code, is_retired, ticker_symbol').eq('is_retired', false).order('name'),
    supabase.from('accounts').select('id, name, currency_code, is_retired').eq('is_retired', false),
    supabase.from('portfolios').select('id, name, is_retired').eq('is_retired', false),
    supabase.from('user_settings').select('base_currency').eq('user_id', user.id).single(),
  ])

  const baseCurrency = settings?.base_currency ?? 'EUR'
  const portfolioIds = (portfolios ?? []).map(p => p.id)
  const accountIds   = (accounts  ?? []).map(a => a.id)
  const securityIds  = (securities ?? []).map(s => s.id)

  // Fetch chart data + recent transactions in parallel
  const [
    { data: recentAcctTxn },
    { data: recentPortTxn },
    { data: allPortTxns },
    { data: priceHistory },
    { data: latestPrices },
  ] = await Promise.all([
    supabase.from('account_transactions')
      .select('id, type, date, amount, currency_code, accounts(name)')
      .in('account_id', accountIds).order('date', { ascending: false }).limit(8),

    supabase.from('portfolio_transactions')
      .select('id, type, date, amount, currency_code, shares, securities(name), portfolios(name)')
      .in('portfolio_id', portfolioIds).order('date', { ascending: false }).limit(8),

    // All portfolio txns for allocation + P&L
    supabase.from('portfolio_transactions')
      .select('*, securities(name, currency_code)')
      .in('portfolio_id', portfolioIds)
      .order('date', { ascending: true }),

    // 12-month price history for first security (primary sparkline)
    securityIds.length > 0
      ? supabase.from('security_prices')
          .select('date, value')
          .eq('security_id', securityIds[0])
          .gte('date', new Date(Date.now() - 400 * 86400 * 1000).toISOString().slice(0, 10))
          .order('date', { ascending: true })
      : Promise.resolve({ data: [] }),

    // Latest price per security
    supabase.from('security_prices')
      .select('security_id, value')
      .in('security_id', securityIds)
      .order('date', { ascending: false }),
  ])

  // Build latest price map (first occurrence = most recent, sorted desc)
  const latestPriceMap = new Map<string, number>()
  for (const p of (latestPrices ?? [])) {
    if (!latestPriceMap.has(p.security_id)) latestPriceMap.set(p.security_id, p.value)
  }

  // Build holdings from all portfolio transactions
  const holdings = buildHoldings((allPortTxns ?? []) as never)

  // Allocation slices (by cost basis)
  const allocData = holdings
    .filter(h => h.costBasis > 0)
    .map(h => ({ name: h.name, value: h.costBasis }))
    .sort((a, b) => b.value - a.value)

  // P&L per holding
  const pnlData = holdings
    .map(h => {
      const price = latestPriceMap.get(h.securityId)
      if (!price) return null
      const currentVal = Math.round((h.shares / 100_000_000) * price)
      const gain = currentVal - h.costBasis
      const pct  = h.costBasis > 0 ? gain / h.costBasis : 0
      return { name: h.name, gain, pct }
    })
    .filter(Boolean) as { name: string; gain: number; pct: number }[]

  // Price history for chart
  const priceChartData = (priceHistory ?? []).map(p => ({
    date: p.date.slice(0, 10),
    value: p.value,
  }))

  // Summary metrics
  const totalCurrentValue = holdings.reduce((s, h) => {
    const price = latestPriceMap.get(h.securityId)
    return s + (price ? Math.round((h.shares / 100_000_000) * price) : 0)
  }, 0)
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasis, 0)
  const totalGain      = totalCurrentValue - totalCostBasis
  const gainPct        = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Portfolio overview · {baseCurrency}</p>
        </div>
        <div className="flex flex-gap-3">
          <Link href="/securities/new" className="btn btn-secondary btn-sm">+ Security</Link>
          <Link href="/transactions/new" className="btn btn-primary btn-sm">+ Transaction</Link>
        </div>
      </div>

      {!securities?.length && !accounts?.length && <SampleDataBanner />}

      {/* Key Metrics */}
      <div className="grid-4 mb-6">
        <div className="metric-card">
          <div className="metric-label">Total Value</div>
          <div className="metric-value" style={{ fontSize: '1.4rem' }}>{formatAmount(totalCurrentValue, baseCurrency)}</div>
          {totalCostBasis > 0 && (
            <div className={`metric-change ${totalGain >= 0 ? 'positive' : 'negative'}`}>
              {totalGain >= 0 ? '▲' : '▼'} {gainPct.toFixed(2)}%
            </div>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-label">Invested Capital</div>
          <div className="metric-value" style={{ fontSize: '1.4rem' }}>{formatAmount(totalCostBasis, baseCurrency)}</div>
          <div className="text-xs text-muted mt-2">Across {holdings.length} position{holdings.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Portfolios</div>
          <div className="metric-value">{portfolios?.length ?? 0}</div>
          <Link href="/portfolios" className="text-xs" style={{ color: 'var(--color-accent-light)', marginTop: 8, display: 'block' }}>View all →</Link>
        </div>
        <div className="metric-card">
          <div className="metric-label">Securities</div>
          <div className="metric-value">{securities?.length ?? 0}</div>
          <Link href="/securities" className="text-xs" style={{ color: 'var(--color-accent-light)', marginTop: 8, display: 'block' }}>View all →</Link>
        </div>
      </div>

      {/* Charts row */}
      {(priceChartData.length > 1 || allocData.length > 0 || pnlData.length > 0) && (
        <DashboardCharts
          priceHistory={priceChartData}
          allocation={allocData}
          pnl={pnlData}
          currency={baseCurrency}
        />
      )}

      {/* Recent Activity */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Account Activity</span>
            <Link href="/transactions" className="text-xs" style={{ color: 'var(--color-accent-light)' }}>View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!recentAcctTxn?.length ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon">💳</div>
                <div className="empty-state-title">No transactions yet</div>
                <Link href="/transactions/new" className="btn btn-primary btn-sm mt-4">Add Transaction</Link>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th>Account</th><th className="table-right">Amount</th></tr></thead>
                  <tbody>
                    {recentAcctTxn.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted text-sm">{formatDate(tx.date)}</td>
                        <td><span className={`badge ${['DEPOSIT','DIVIDENDS','INTEREST','SELL'].includes(tx.type) ? 'badge-green' : tx.type === 'BUY' ? 'badge-purple' : 'badge-red'}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>{tx.type}</span></td>
                        <td className="text-sm text-muted truncate" style={{ maxWidth: 110 }}>{(tx.accounts as unknown as { name: string } | null)?.name ?? '—'}</td>
                        <td className={`table-right font-mono text-sm ${['DEPOSIT','DIVIDENDS','INTEREST','SELL'].includes(tx.type) ? 'amount-positive' : 'amount-negative'}`}>{formatAmount(tx.amount, tx.currency_code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Portfolio Trades</span>
            <Link href="/transactions" className="text-xs" style={{ color: 'var(--color-accent-light)' }}>View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!recentPortTxn?.length ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">No trades yet</div>
                <Link href="/portfolios" className="btn btn-primary btn-sm mt-4">Set up Portfolio</Link>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th>Security</th><th className="table-right">Amount</th></tr></thead>
                  <tbody>
                    {recentPortTxn.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted text-sm">{formatDate(tx.date)}</td>
                        <td><span className={`badge ${['BUY','DELIVERY_INBOUND'].includes(tx.type) ? 'badge-purple' : 'badge-yellow'}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>{tx.type}</span></td>
                        <td className="text-sm truncate" style={{ maxWidth: 110 }}>{(tx.securities as unknown as { name: string } | null)?.name ?? '—'}</td>
                        <td className="table-right font-mono text-sm">{formatAmount(tx.amount, tx.currency_code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid-4 mt-4">
        {[
          { href: '/securities/new', icon: '📈', label: 'Add Security' },
          { href: '/accounts',       icon: '💳', label: 'Accounts' },
          { href: '/watchlists',     icon: '⭐', label: 'Watchlists' },
          { href: '/taxonomies',     icon: '🗂️', label: 'Allocation' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.2s' }}>
            <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
