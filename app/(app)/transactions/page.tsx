import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ACCOUNT_TX_LABELS, PORTFOLIO_TX_LABELS } from '@/lib/format'
import dynamicImport from 'next/dynamic'
import type { TxRow } from '@/components/grids/TransactionsGrid'
export const dynamic = 'force-dynamic'

const TransactionsGrid = dynamicImport(() => import('@/components/grids/TransactionsGrid'), { ssr: false })

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: accounts }  = await supabase.from('accounts').select('id').eq('is_retired', false)
  const { data: portfolios } = await supabase.from('portfolios').select('id').eq('is_retired', false)

  const [{ data: acctTxns }, { data: portTxns }] = await Promise.all([
    supabase.from('account_transactions')
      .select('*, accounts(name), securities(name)')
      .in('account_id', (accounts ?? []).map(a => a.id))
      .order('date', { ascending: false })
      .limit(500),
    supabase.from('portfolio_transactions')
      .select('*, portfolios(name), securities(name)')
      .in('portfolio_id', (portfolios ?? []).map(p => p.id))
      .order('date', { ascending: false })
      .limit(500),
  ])

  const rows: TxRow[] = [
    ...(acctTxns ?? []).map(t => ({
      id:               `a-${t.id}`,
      date:             t.date,
      kind:             'account' as const,
      type:             t.type,
      type_label:       ACCOUNT_TX_LABELS[t.type] ?? t.type,
      security_name:    (t.securities as unknown as { name: string } | null)?.name ?? null,
      account_portfolio:(t.accounts  as unknown as { name: string } | null)?.name ?? null,
      shares:           null,
      amount:           t.amount,
    })),
    ...(portTxns ?? []).map(t => ({
      id:               `p-${t.id}`,
      date:             t.date,
      kind:             'portfolio' as const,
      type:             t.type,
      type_label:       PORTFOLIO_TX_LABELS[t.type] ?? t.type,
      security_name:    (t.securities as unknown as { name: string } | null)?.name ?? null,
      account_portfolio:(t.portfolios as unknown as { name: string } | null)?.name ?? null,
      shares:           t.shares ? t.shares / 100_000_000 : null,
      amount:           t.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">All account and portfolio transactions · {rows.length} records</p>
        </div>
        <div className="flex flex-gap-3">
          <Link href="/accounts"   className="btn btn-secondary btn-sm">Account Transaction</Link>
          <Link href="/portfolios" className="btn btn-primary btn-sm">Portfolio Trade</Link>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-text">Add an account deposit or a portfolio trade to get started.</div>
          </div>
        ) : (
          <TransactionsGrid rows={rows} />
        )}
      </div>
    </>
  )
}
