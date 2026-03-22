import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate, percentChange, formatPercent } from '@/lib/format'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch core data in parallel
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

  // Get recent transactions (account + portfolio)
  const { data: recentAcctTxn } = await supabase
    .from('account_transactions')
    .select('id, type, date, amount, currency_code, note, accounts(name), securities(name)')
    .in('account_id', (accounts ?? []).map(a => a.id))
    .order('date', { ascending: false })
    .limit(8)

  const { data: recentPortTxn } = await supabase
    .from('portfolio_transactions')
    .select('id, type, date, amount, currency_code, shares, securities(name), portfolios(name)')
    .in('portfolio_id', (portfolios ?? []).map(p => p.id))
    .order('date', { ascending: false })
    .limit(8)

  // Get latest prices for value estimates
  const { data: latestPrices } = await supabase
    .from('security_latest_prices')
    .select('security_id, value, previous_close')
    .in('security_id', (securities ?? []).map(s => s.id))

  const latestPriceMap = new Map(latestPrices?.map(p => [p.security_id, p]) ?? [])

  const totalAssets = latestPrices?.reduce((s, p) => s + p.value, 0) ?? 0
  const gainers = latestPrices?.filter(p => p.previous_close && p.value > p.previous_close).length ?? 0
  const losers = latestPrices?.filter(p => p.previous_close && p.value < p.previous_close).length ?? 0

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your portfolio overview · Base currency: {baseCurrency}</p>
        </div>
        <div className="flex flex-gap-3">
          <Link href="/securities/new" className="btn btn-secondary btn-sm">+ Security</Link>
          <Link href="/transactions/new" className="btn btn-primary btn-sm">+ Transaction</Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid-4 mb-6">
        <div className="metric-card">
          <div className="metric-label">Securities</div>
          <div className="metric-value">{securities?.length ?? 0}</div>
          <div className="text-xs text-muted mt-2">{gainers} up · {losers} down today</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Portfolios</div>
          <div className="metric-value">{portfolios?.length ?? 0}</div>
          <Link href="/portfolios" className="text-xs" style={{ color: 'var(--color-accent-light)', marginTop: 8, display: 'block' }}>View all →</Link>
        </div>
        <div className="metric-card">
          <div className="metric-label">Accounts</div>
          <div className="metric-value">{accounts?.length ?? 0}</div>
          <Link href="/accounts" className="text-xs" style={{ color: 'var(--color-accent-light)', marginTop: 8, display: 'block' }}>View all →</Link>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tracked Prices</div>
          <div className="metric-value">{latestPrices?.length ?? 0}</div>
          <div className="text-xs text-muted mt-2">Latest market data</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Account Transactions */}
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
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Account</th>
                      <th className="table-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAcctTxn.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted text-sm">{formatDate(tx.date)}</td>
                        <td>
                          <span className={`badge badge-sm ${tx.type === 'DEPOSIT' || tx.type === 'DIVIDENDS' || tx.type === 'INTEREST' ? 'badge-green' : tx.type === 'BUY' ? 'badge-purple' : tx.type === 'SELL' ? 'badge-yellow' : 'badge-red'}`}
                            style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="text-sm text-muted truncate" style={{ maxWidth: 120 }}>
                          {(tx.accounts as unknown as { name: string } | null)?.name ?? '—'}
                        </td>
                        <td className={`table-right font-mono text-sm ${tx.type === 'DEPOSIT' || tx.type === 'DIVIDENDS' || tx.type === 'INTEREST' || tx.type === 'SELL' ? 'amount-positive' : 'amount-negative'}`}>
                          {formatAmount(tx.amount, tx.currency_code)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Portfolio Transactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Portfolio Activity</span>
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
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Security</th>
                      <th className="table-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPortTxn.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted text-sm">{formatDate(tx.date)}</td>
                        <td>
                          <span className={`badge ${tx.type === 'BUY' || tx.type === 'DELIVERY_INBOUND' ? 'badge-purple' : 'badge-yellow'}`}
                            style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="text-sm truncate" style={{ maxWidth: 120 }}>
                          {(tx.securities as unknown as { name: string } | null)?.name ?? '—'}
                        </td>
                        <td className="table-right font-mono text-sm">
                          {formatAmount(tx.amount, tx.currency_code)}
                        </td>
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
          { href: '/accounts', icon: '💳', label: 'Manage Accounts' },
          { href: '/watchlists', icon: '⭐', label: 'Watchlists' },
          { href: '/taxonomies', icon: '🗂️', label: 'Asset Allocation' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="card" style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textDecoration: 'none',
            transition: 'border-color 0.2s',
          }}>
            <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
