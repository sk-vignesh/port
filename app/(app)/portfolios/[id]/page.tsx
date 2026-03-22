import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate, txBadgeClass, PORTFOLIO_TX_LABELS } from '@/lib/format'
import PortfolioPerformancePanel from '@/components/PortfolioPerformancePanel'
export const dynamic = 'force-dynamic'

export default async function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: portfolio }, { data: transactions }, { data: settings }] = await Promise.all([
    supabase.from('portfolios').select('*, accounts(name, currency_code)').eq('id', id).single(),
    supabase.from('portfolio_transactions')
      .select('*, securities(name, currency_code)')
      .eq('portfolio_id', id)
      .order('date', { ascending: false })
      .limit(300),
    supabase.from('user_settings').select('base_currency').eq('user_id', user.id).single(),
  ])

  if (!portfolio) notFound()

  const refAccount = portfolio.accounts as unknown as { name: string; currency_code: string } | null
  const currency = refAccount?.currency_code ?? settings?.base_currency ?? 'INR'

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
            {refAccount && (
              <span className="text-sm text-muted">
                Reference: {refAccount.name} ({currency})
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-gap-3">
          <Link href={`/portfolios/${id}/transactions/new`} className="btn btn-primary">+ Trade</Link>
          <Link href={`/portfolios/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      {/* Performance panel — fetches metrics client-side */}
      <PortfolioPerformancePanel portfolioId={id} currency={currency} />

      {/* Transaction History */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Transactions ({transactions?.length ?? 0})</span>
          <Link href={`/portfolios/${id}/transactions/new`} className="btn btn-primary btn-sm">+ Trade</Link>
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
                <th className="table-right">Price/Share</th>
              </tr>
            </thead>
            <tbody>
              {!transactions?.length ? (
                <tr><td colSpan={6}><div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-text">No transactions yet — add a Buy to get started.</div>
                </div></td></tr>
              ) : transactions.map(tx => {
                const shares = tx.shares / 100_000_000
                const pricePerShare = shares > 0 ? Math.round(tx.amount / shares) : 0
                const isBuy = tx.type === 'BUY' || tx.type === 'DELIVERY_INBOUND'
                return (
                  <tr key={tx.id}>
                    <td className="text-sm text-muted">{formatDate(tx.date)}</td>
                    <td><span className={`badge ${txBadgeClass(tx.type)}`} style={{ fontSize: '0.7rem' }}>
                      {PORTFOLIO_TX_LABELS[tx.type] ?? tx.type}
                    </span></td>
                    <td className="text-sm">{(tx.securities as unknown as { name: string } | null)?.name ?? '—'}</td>
                    <td className="table-right font-mono text-sm">{shares > 0 ? Math.round(shares) : '—'}</td>
                    <td className={`table-right font-mono text-sm ${isBuy ? 'amount-negative' : 'amount-positive'}`}>
                      {formatAmount(tx.amount, tx.currency_code)}
                    </td>
                    <td className="table-right font-mono text-sm text-muted">
                      {shares > 0 ? formatAmount(pricePerShare, tx.currency_code) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
