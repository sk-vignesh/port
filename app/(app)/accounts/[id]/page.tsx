import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate, ACCOUNT_TX_LABELS, txBadgeClass } from '@/lib/format'
export const dynamic = 'force-dynamic'

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: account }, { data: transactions }] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).single(),
    supabase.from('account_transactions')
      .select('*, securities(name)')
      .eq('account_id', id)
      .order('date', { ascending: false })
      .limit(200),
  ])

  if (!account) notFound()

  // Calculate running balance
  let balance = 0
  const creditTypes = ['DEPOSIT', 'INTEREST', 'DIVIDENDS', 'FEES_REFUND', 'TAX_REFUND', 'SELL', 'TRANSFER_IN']
  for (const tx of transactions ?? []) {
    if (creditTypes.includes(tx.type)) balance += tx.amount
    else balance -= tx.amount
  }

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/accounts" style={{ color: 'var(--color-accent-light)' }}>Accounts</Link>
            {' / '}<span>{account.name}</span>
          </div>
          <h1 className="page-title">{account.name}</h1>
          <div className="flex flex-gap-2 mt-2">
            <span className="badge badge-blue">{account.currency_code}</span>
            <span className={`badge ${account.is_retired ? 'badge-gray' : 'badge-green'}`}>
              {account.is_retired ? 'Retired' : 'Active'}
            </span>
          </div>
        </div>
        <div className="flex flex-gap-3 items-center">
          <div className="metric-card" style={{ padding: '16px 24px', minWidth: 180 }}>
            <div className="metric-label">Balance (est.)</div>
            <div className={`metric-value ${balance >= 0 ? 'amount-positive' : 'amount-negative'}`} style={{ fontSize: '1.3rem' }}>
              {formatAmount(balance, account.currency_code)}
            </div>
          </div>
          <Link href={`/accounts/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Transactions ({transactions?.length ?? 0})</span>
          <Link href={`/accounts/${id}/transactions/new`} className="btn btn-primary btn-sm">+ Add</Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Security</th>
                <th>Note</th>
                <th className="table-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {!transactions?.length ? (
                <tr><td colSpan={5}><div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-text">No transactions in this account yet</div>
                </div></td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="text-sm text-muted">{formatDate(tx.date)}</td>
                  <td><span className={`badge ${txBadgeClass(tx.type)}`} style={{ fontSize: '0.7rem' }}>
                    {ACCOUNT_TX_LABELS[tx.type] ?? tx.type}
                  </span></td>
                  <td className="text-sm">{(tx.securities as unknown as { name: string } | null)?.name ?? '—'}</td>
                  <td className="text-sm text-muted truncate" style={{ maxWidth: 160 }}>{tx.note ?? '—'}</td>
                  <td className={`table-right font-mono text-sm ${creditTypes.includes(tx.type) ? 'amount-positive' : 'amount-negative'}`}>
                    {creditTypes.includes(tx.type) ? '+' : '-'}{formatAmount(tx.amount, tx.currency_code)}
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
