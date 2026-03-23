import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ACCOUNT_TX_LABELS, txBadgeClass } from '@/lib/format'
import dynamicImport from 'next/dynamic'
import type { AccountTxRow } from '@/components/grids/AccountTransactionsGrid'
export const dynamic = 'force-dynamic'

const AccountTransactionsGrid = dynamicImport(() => import('@/components/grids/AccountTransactionsGrid'), { ssr: false })

const CREDIT = new Set(['DEPOSIT','INTEREST','DIVIDENDS','FEES_REFUND','TAX_REFUND','SELL','TRANSFER_IN'])

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: account }, { data: transactions }] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).single(),
    supabase.from('account_transactions')
      .select('*, securities(name)')
      .eq('account_id', id)
      .order('date', { ascending: false })
      .limit(500),
  ])

  if (!account) notFound()

  let balance = 0
  for (const tx of transactions ?? []) {
    if (CREDIT.has(tx.type)) balance += tx.amount
    else balance -= tx.amount
  }

  const rows: AccountTxRow[] = (transactions ?? []).map(tx => ({
    id:            tx.id,
    date:          tx.date,
    type:          tx.type,
    type_label:    ACCOUNT_TX_LABELS[tx.type] ?? tx.type,
    security_name: (tx.securities as unknown as { name: string } | null)?.name ?? null,
    note:          tx.note ?? null,
    amount:        tx.amount,
  }))

  const fmtINR = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

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
              {fmtINR(balance / 100)}
            </div>
          </div>
          <Link href={`/accounts/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="card-header" style={{ padding: '0 0 12px' }}>
          <span className="card-title">Transactions ({rows.length})</span>
          <Link href={`/accounts/${id}/transactions/new`} className="btn btn-primary btn-sm">+ Add</Link>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-text">No transactions in this account yet</div>
          </div>
        ) : (
          <AccountTransactionsGrid rows={rows} />
        )}
      </div>
    </>
  )
}
