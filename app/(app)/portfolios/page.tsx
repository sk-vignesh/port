import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buildHoldings, enrichHoldings } from '@/lib/performance'
import { formatAmount, formatPercent } from '@/lib/format'
export const dynamic = 'force-dynamic'

const ASSET_CLASS_ICONS: Record<string, string> = {
  EQUITY:       '📈',
  COMMODITY:    '🥇',
  FIXED_INCOME: '🏦',
  REAL_ESTATE:  '🏠',
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  EQUITY:       'Stocks & ETFs',
  COMMODITY:    'Commodities',
  FIXED_INCOME: 'Fixed Income',
  REAL_ESTATE:  'Real Estate',
}

export default async function PortfoliosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase.from('user_settings').select('base_currency').eq('user_id', user.id).maybeSingle()
  const currency = settings?.base_currency ?? 'INR'

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name, is_retired, note, asset_class, updated_at')
    .order('name')

  const portfolioList = (portfolios as unknown as Array<{
    id: string; name: string; is_retired: boolean; note: string | null;
    asset_class: string | null; updated_at: string
  }> ?? [])

  if (!portfolioList.length) {
    return (
      <>
        <div className="page-header flex-between">
          <div>
            <h1 className="page-title">Asset Classes</h1>
            <p className="page-subtitle">Your investment buckets — each with its own holdings and performance</p>
          </div>
          <Link href="/portfolios/new" className="btn btn-primary">+ New Asset Class</Link>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No asset classes yet</div>
            <div className="empty-state-text">Create your first asset class to start tracking your investments.</div>
            <Link href="/portfolios/new" className="btn btn-primary mt-4">+ New Asset Class</Link>
          </div>
        </div>
      </>
    )
  }

  // Fetch all transactions + prices for enrichment in one go
  const portfolioIds = portfolioList.map(p => p.id)

  const { data: allTxns } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(id, name, currency_code)')
    .in('portfolio_id', portfolioIds)
    .order('date', { ascending: true })

  const allSecurityIds = [...new Set((allTxns ?? []).map(t => ((t.securities as unknown as { id: string } | null)?.id)).filter(Boolean))] as string[]
  const { data: allPrices } = await supabase
    .from('security_prices')
    .select('security_id, value')
    .in('security_id', allSecurityIds.length ? allSecurityIds : ['00000000-0000-0000-0000-000000000000'])
    .order('date', { ascending: false })

  const priceMap = new Map<string, number>()
  for (const p of allPrices ?? []) {
    if (!priceMap.has(p.security_id)) priceMap.set(p.security_id, p.value)
  }

  // Build per-portfolio stats
  interface PortfoliaoStat {
    currentValue: number; costBasis: number; gain: number; gainPct: number; positions: number
  }
  const statsMap = new Map<string, PortfoliaoStat>()
  for (const p of portfolioList) {
    const txns = (allTxns ?? []).filter(t => t.portfolio_id === p.id)
    const holdings = buildHoldings(txns as never)
    const enriched = enrichHoldings(holdings, priceMap)
    const cost  = enriched.reduce((s, h) => s + h.costBasis, 0)
    const value = enriched.reduce((s, h) => s + (h.currentValue ?? h.costBasis), 0)
    const gain  = value - cost
    statsMap.set(p.id, {
      currentValue: value,
      costBasis: cost,
      gain,
      gainPct: cost > 0 ? gain / cost : 0,
      positions: enriched.filter(h => h.shares > 0).length,
    })
  }

  // Grand totals
  const grandValue  = portfolioList.reduce((s, p) => s + (statsMap.get(p.id)?.currentValue ?? 0), 0)
  const grandCost   = portfolioList.reduce((s, p) => s + (statsMap.get(p.id)?.costBasis ?? 0), 0)
  const grandGain   = grandValue - grandCost
  const grandGainPct = grandCost > 0 ? (grandGain / grandCost) * 100 : 0

  return (
    <>
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Asset Classes</h1>
          <p className="page-subtitle">Your investment buckets — each with its own holdings and performance</p>
        </div>
        <Link href="/portfolios/new" className="btn btn-primary">+ New Asset Class</Link>
      </div>

      {/* Grand total strip */}
      <div className="card mb-6" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Total Portfolio Value
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
              {formatAmount(grandValue, currency)}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {[
            { label: 'Invested', value: formatAmount(grandCost, currency), color: '' },
            { label: 'Overall Gain', value: `${grandGain >= 0 ? '+' : ''}${formatAmount(grandGain, currency)}`, color: grandGain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: 'Return', value: `${grandGainPct >= 0 ? '+' : ''}${grandGainPct.toFixed(1)}%`, color: grandGainPct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: 'Asset Classes', value: String(portfolioList.length), color: '' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ minWidth: 100 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid-2">
        {portfolioList.map(p => {
          const st = statsMap.get(p.id) ?? { currentValue: 0, costBasis: 0, gain: 0, gainPct: 0, positions: 0 }
          const ac = (p.asset_class as string | null) ?? 'EQUITY'
          const icon = ASSET_CLASS_ICONS[ac] ?? '📊'
          const subLabel = ASSET_CLASS_LABELS[ac] ?? ac

          return (
            <Link key={p.id} href={`/portfolios/${p.id}`} className="card"
              style={{ padding: 24, display: 'block', textDecoration: 'none', transition: 'border-color 0.2s, transform 0.15s' }}
              onMouseEnter={(e) => {(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}}
              onMouseLeave={(e) => {(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}}>

              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', background: 'var(--color-bg-input)', flexShrink: 0,
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{subLabel}</div>
                  </div>
                </div>
                <span className={`badge ${p.is_retired ? 'badge-gray' : 'badge-green'}`} style={{ fontSize: '0.65rem' }}>
                  {p.is_retired ? 'Retired' : 'Active'}
                </span>
              </div>

              {/* Value */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Current Value</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                  {st.costBasis > 0 ? formatAmount(st.currentValue, currency) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>No trades yet</span>}
                </div>
              </div>

              {/* Stats row */}
              {st.costBasis > 0 && (
                <div style={{ display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Gain / Loss</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: st.gain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {st.gain >= 0 ? '+' : ''}{formatAmount(st.gain, currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Return</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: st.gainPct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {st.gainPct >= 0 ? '+' : ''}{(st.gainPct * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Invested</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{formatAmount(st.costBasis, currency)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Holdings</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{st.positions}</div>
                  </div>
                </div>
              )}

              {/* No trades CTA */}
              {st.costBasis === 0 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-accent-light)', fontWeight: 600 }}>Add your first trade →</span>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
