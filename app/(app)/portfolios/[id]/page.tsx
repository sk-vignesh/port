import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PORTFOLIO_TX_LABELS } from '@/lib/format'
import PortfolioPerformancePanel from '@/components/PortfolioPerformancePanel'
import dynamicImport from 'next/dynamic'
import type { PortfolioTxRow } from '@/components/grids/PortfolioTransactionsGrid'
export const dynamic = 'force-dynamic'

const PortfolioTransactionsGrid = dynamicImport(() => import('@/components/grids/PortfolioTransactionsGrid'), { ssr: false })

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
      .limit(500),
    supabase.from('user_settings').select('base_currency').eq('user_id', user.id).single(),
  ])

  if (!portfolio) notFound()

  const refAccount = portfolio.accounts as unknown as { name: string; currency_code: string } | null
  const currency = refAccount?.currency_code ?? settings?.base_currency ?? 'INR'

  const rows: PortfolioTxRow[] = (transactions ?? []).map(tx => ({
    id:            tx.id,
    date:          tx.date,
    type:          tx.type,
    type_label:    PORTFOLIO_TX_LABELS[tx.type] ?? tx.type,
    security_name: (tx.securities as unknown as { name: string } | null)?.name ?? null,
    shares:        tx.shares,
    amount:        tx.amount,
  }))

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
              <span className="text-sm text-muted">Reference: {refAccount.name} ({currency})</span>
            )}
          </div>
        </div>
        <div className="flex flex-gap-3">
          <Link href={`/portfolios/${id}/transactions/new`} className="btn btn-primary">+ Trade</Link>
          <Link href={`/portfolios/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      <PortfolioPerformancePanel portfolioId={id} currency={currency} />

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="card-header" style={{ padding: '0 0 12px' }}>
          <span className="card-title">Transactions ({rows.length})</span>
          <Link href={`/portfolios/${id}/transactions/new`} className="btn btn-primary btn-sm">+ Trade</Link>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-text">No transactions yet — add a Buy to get started.</div>
          </div>
        ) : (
          <PortfolioTransactionsGrid rows={rows} />
        )}
      </div>
    </>
  )
}
