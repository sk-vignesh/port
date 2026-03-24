import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import TradeFormRouter from './TradeFormRouter'
export const dynamic = 'force-dynamic'

const ASSET_CLASS_META: Record<string, { label: string; icon: string; subtitle: string }> = {
  EQUITY:       { label: 'Equity Trade',       icon: '📈', subtitle: 'Stocks, ETFs, Mutual Funds' },
  COMMODITY:    { label: 'Commodity Trade',     icon: '🥇', subtitle: 'Gold, Silver, Oil and other commodities' },
  FIXED_INCOME: { label: 'Fixed Income Entry',  icon: '🏦', subtitle: 'FDs, Bonds, PPF, NSC and debt instruments' },
  REAL_ESTATE:  { label: 'Real Estate Entry',   icon: '🏠', subtitle: 'Property purchase, sale, rental income' },
}

export default async function NewPortfolioTransactionPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: portfolioRaw } = await supabase
    .from('portfolios')
    .select('id, name, asset_class')
    .eq('id', params.id)
    .single()

  if (!portfolioRaw) notFound()

  // asset_class may not be in generated types until migration 009 is applied
  const portfolio = portfolioRaw as unknown as { id: string; name: string; asset_class: string | null }
  const assetClass = portfolio.asset_class ?? 'EQUITY'
  const meta = ASSET_CLASS_META[assetClass] ?? ASSET_CLASS_META['EQUITY']

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="text-sm text-muted mb-2">
          <Link href="/portfolios" style={{ color: 'var(--color-accent-light)' }}>Portfolios</Link>
          {' / '}
          <Link href={`/portfolios/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>{portfolio.name}</Link>
          {' / New Trade'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: '2rem' }}>{meta.icon}</span>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 2 }}>{meta.label}</h1>
            <p className="text-muted text-sm">{meta.subtitle}</p>
          </div>
        </div>
      </div>

      <TradeFormRouter portfolioId={params.id} assetClass={assetClass} />
    </div>
  )
}
