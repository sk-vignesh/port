import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatShares, formatDate, txBadgeClass, PORTFOLIO_TX_LABELS } from '@/lib/format'
export const dynamic = 'force-dynamic'

export default async function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: portfolio }, { data: transactions }] = await Promise.all([
    supabase.from('portfolios').select('*, accounts(name)').eq('id', id).single(),
    supabase.from('portfolio_transactions')
      .select('*, securities(name, currency_code), portfolio_transaction_units(*)')
      .eq('portfolio_id', id)
      .order('date', { ascending: false })
      .limit(300),
  ])

  if (!portfolio) notFound()

  // Build holdings from transactions (FIFO cost basis approximation)
  const holdingsMap = new Map<string, {
    name: string; currency: string; shares: number; totalCost: number; transactionCount: number
  }>()

  for (const tx of [...(transactions ?? [])].reverse()) {
    const sec = tx.securities as unknown as { name: string; currency_code: string } | null
    if (!sec) continue
    const key = tx.security_id
    const existing = holdingsMap.get(key) ?? { name: sec.name, currency: sec.currency_code, shares: 0, totalCost: 0, transactionCount: 0 }

    if (tx.type === 'BUY' || tx.type === 'DELIVERY_INBOUND' || tx.type === 'TRANSFER_IN') {
      existing.shares += tx.shares
      existing.totalCost += tx.amount
      existing.transactionCount++
    } else if (tx.type === 'SELL' || tx.type === 'DELIVERY_OUTBOUND' || tx.type === 'TRANSFER_OUT') {
      existing.shares -= tx.shares
      existing.transactionCount++
    }
    holdingsMap.set(key, existing)
  }

  const holdings = Array.from(holdingsMap.entries())
    .filter(([_, h]) => h.shares > 0)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Portfolios</Link>
            {' / '}<span>{portfolio.name}</span>
          </div>
          <h1 className="page-title">{portfolio.name}</h1>
          <div className="flex flex-gap-2 mt-2">
            <span className={`badge ${portfolio.is_retired ? 'badge-gray' : 'badge-green'}`}>
              {portfolio.is_retired ? 'Retired' : 'Active'}
            </span>
            <span className="text-sm text-muted">
              Reference: {(portfolio.accounts as unknown as { name: string } | null)?.name ?? 'None'}
            </span>
          </div>
        </div>
        <div className="flex flex-gap-3">
          <Link href={`/portfolios/${id}/transactions/new`} className="btn btn-primary">+ Trade</Link>
          <Link href={`/portfolios/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      {/* Holdings */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">Holdings ({holdings.length})</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Security</th>
                <th className="table-right">Shares</th>
                <th className="table-right">Cost Basis (est.)</th>
                <th className="table-right">Avg. Cost/Share</th>
                <th>Trades</th>
              </tr>
            </thead>
            <tbody>
              {!holdings.length ? (
                <tr><td colSpan={5}><div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-text">No open holdings. Add a buy transaction to get started.</div>
                </div></td></tr>
              ) : holdings.map(([secId, h]) => (
                <tr key={secId}>
                  <td>
                    <Link href={`/securities/${secId}`} style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>{h.name}</Link>
                  </td>
                  <td className="table-right font-mono text-sm">{formatShares(h.shares)}</td>
                  <td className="table-right font-mono text-sm">{formatAmount(h.totalCost, h.currency)}</td>
                  <td className="table-right font-mono text-sm">
                    {h.shares > 0 ? formatAmount(Math.round(h.totalCost / (h.shares / 100_000_000) * 100) / 100, h.currency) : '—'}
                  </td>
                  <td className="text-sm text-muted">{h.transactionCount}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Transactions ({transactions?.length ?? 0})</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Security</th>
                <th className="table-right">Shares</th>
                <th className="table-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {!transactions?.length ? (
                <tr><td colSpan={5}><div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-text">No transactions yet</div>
                </div></td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="text-sm text-muted">{formatDate(tx.date)}</td>
                  <td><span className={`badge ${txBadgeClass(tx.type)}`} style={{ fontSize: '0.7rem' }}>
                    {PORTFOLIO_TX_LABELS[tx.type] ?? tx.type}
                  </span></td>
                  <td className="text-sm">{(tx.securities as unknown as { name: string } | null)?.name ?? '—'}</td>
                  <td className="table-right font-mono text-sm">{formatShares(tx.shares)}</td>
                  <td className={`table-right font-mono text-sm ${tx.type === 'BUY' || tx.type === 'DELIVERY_INBOUND' ? 'amount-negative' : 'amount-positive'}`}>
                    {formatAmount(tx.amount, tx.currency_code)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
