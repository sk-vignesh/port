import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PORTFOLIO_TX_LABELS } from '@/lib/format'
import PortfolioPerformancePanel from '@/components/PortfolioPerformancePanel'
import PortfolioDetailClient from '@/components/PortfolioDetailClient'
import FDCard from '@/components/FDCard'
import type { PortfolioTxRow } from '@/components/grids/PortfolioTransactionsGrid'
import type { FDTransaction } from '@/lib/fd'
export const dynamic = 'force-dynamic'

export default async function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: portfolio }, { data: transactions }, { data: settings }] = await Promise.all([
    supabase.from('portfolios').select('*, accounts(name, currency_code)').eq('id', id).single(),
    supabase.from('portfolio_transactions')
      .select('*, securities(id, name, currency_code)')
      .eq('portfolio_id', id)
      .order('date', { ascending: false })
      .limit(500),
    supabase.from('user_settings').select('base_currency').eq('user_id', user.id).single(),
  ])

  if (!portfolio) notFound()

  const refAccount   = portfolio.accounts as unknown as { name: string; currency_code: string } | null
  const currency     = refAccount?.currency_code ?? settings?.base_currency ?? 'INR'
  const assetClass   = (portfolio as unknown as { asset_class?: string }).asset_class ?? 'EQUITY'

  const rows: PortfolioTxRow[] = (transactions ?? []).map(tx => ({
    id:            tx.id,
    date:          tx.date,
    type:          tx.type,
    type_label:    PORTFOLIO_TX_LABELS[tx.type] ?? tx.type,
    security_id:   (tx.securities as unknown as { id?: string } | null)?.id ?? null,
    security_name: (tx.securities as unknown as { name: string } | null)?.name ?? null,
    shares:        tx.shares,
    amount:        tx.amount,
  }))

  // FD card rows — BUY transactions with face_value for FIXED_INCOME portfolios
  type RawTx = typeof transactions extends (infer T)[] | null ? T : never
  const fdTxns: (FDTransaction & { security_name?: string | null })[] =
    assetClass === 'FIXED_INCOME'
      ? (transactions ?? [])
          .filter(tx => tx.type === 'BUY' && (tx as unknown as { face_value?: number }).face_value)
          .map(tx => {
            const raw = tx as unknown as {
              face_value?: number; coupon_rate?: number
              interest_frequency?: string; maturity_date?: string
            }
            return {
              date:               tx.date,
              maturity_date:      raw.maturity_date ?? null,
              face_value:         raw.face_value ?? null,
              coupon_rate:        raw.coupon_rate ?? null,
              interest_frequency: (raw.interest_frequency ?? null) as FDTransaction['interest_frequency'],
              type:               tx.type,
              security_name:      (tx.securities as unknown as { name?: string } | null)?.name ?? null,
            }
          })
      : []

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Asset Classes</Link>
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
          <Link href={`/portfolios/${id}/transactions/new?type=BUY`} className="btn btn-primary" style={{ background: '#22c55e', borderColor: '#22c55e' }}>↑ Buy</Link>
          <Link href={`/portfolios/${id}/transactions/new?type=SELL`} className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }}>↓ Sell</Link>
          <Link href={`/portfolios/${id}/edit`} className="btn btn-secondary">Edit</Link>
        </div>
      </div>

      <PortfolioPerformancePanel portfolioId={id} currency={currency} />

      {/* ── FD Summary Cards (FIXED_INCOME portfolios only) ── */}
      {fdTxns.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--color-text-muted)',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            📑 Active Deposits &amp; Instruments
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {fdTxns.map((tx, i) => (
              <FDCard key={i} tx={tx} currency={currency} />
            ))}
          </div>
        </div>
      )}

      <PortfolioDetailClient portfolioId={id} rows={rows} />
    </>
  )
}
