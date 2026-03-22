import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatShares, formatDate, ACCOUNT_TX_LABELS, PORTFOLIO_TX_LABELS, txBadgeClass } from '@/lib/format'
export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: accounts } = await supabase.from('accounts').select('id').eq('is_retired', false)
  const { data: portfolios } = await supabase.from('portfolios').select('id').eq('is_retired', false)

  const [{ data: acctTxns }, { data: portTxns }] = await Promise.all([
    supabase.from('account_transactions')
      .select('*, accounts(name), securities(name)')
      .in('account_id', (accounts ?? []).map(a => a.id))
      .order('date', { ascending: false })
      .limit(150),
    supabase.from('portfolio_transactions')
      .select('*, portfolios(name), securities(name)')
      .in('portfolio_id', (portfolios ?? []).map(p => p.id))
      .order('date', { ascending: false })
      .limit(150),
  ])

  const combined = [
    ...(acctTxns ?? []).map(t => ({ ...t, _kind: 'account' as const })),
    ...(portTxns ?? []).map(t => ({ ...t, _kind: 'portfolio' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200)

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">All account and portfolio transactions · {combined.length} shown</p>
        </div>
        <div className="flex flex-gap-3">
          <Link href="/accounts" className="btn btn-secondary btn-sm">Account Transaction</Link>
          <Link href="/portfolios" className="btn btn-primary btn-sm">Portfolio Trade</Link>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Kind</th>
                <th>Type</th>
                <th>Security</th>
                <th>Account / Portfolio</th>
                <th className="table-right">Shares</th>
                <th className="table-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {!combined.length ? (
                <tr><td colSpan={7}><div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">No transactions yet</div>
                  <div className="empty-state-text">Add an account deposit or a portfolio trade to get started.</div>
                </div></td></tr>
              ) : combined.map(tx => (
                <tr key={`${tx._kind}-${tx.id}`}>
                  <td className="text-sm text-muted">{formatDate(tx.date)}</td>
                  <td>
                    <span className={`badge ${tx._kind === 'account' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                      {tx._kind === 'account' ? 'Cash' : 'Depot'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${txBadgeClass(tx.type)}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                      {tx._kind === 'account'
                        ? (ACCOUNT_TX_LABELS[tx.type] ?? tx.type)
                        : (PORTFOLIO_TX_LABELS[tx.type] ?? tx.type)}
                    </span>
                  </td>
                  <td className="text-sm">
                    {(tx.securities as unknown as { name: string } | null)?.name ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="text-sm text-muted">
                    {tx._kind === 'account'
                      ? (tx.accounts as unknown as { name: string } | null)?.name
                      : (tx.portfolios as unknown as { name: string } | null)?.name}
                  </td>
                  <td className="table-right font-mono text-sm text-muted">
                    {'shares' in tx && tx.shares ? formatShares(tx.shares) : '—'}
                  </td>
                  <td className="table-right font-mono text-sm">
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
