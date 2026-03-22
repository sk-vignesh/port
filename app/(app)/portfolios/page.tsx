import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatShares, formatDate, txBadgeClass, PORTFOLIO_TX_LABELS } from '@/lib/format'

export default async function PortfoliosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('*, accounts(name)')
    .order('name')

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Portfolios</h1>
          <p className="page-subtitle">Securities depots with holdings and performance</p>
        </div>
        <Link href="/portfolios/new" className="btn btn-primary">+ Add Portfolio</Link>
      </div>

      <div className="grid-2">
        {!portfolios?.length ? (
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No portfolios yet</div>
              <div className="empty-state-text">Create a portfolio to track your security holdings.</div>
              <Link href="/portfolios/new" className="btn btn-primary mt-4">Create Portfolio</Link>
            </div>
          </div>
        ) : portfolios.map(p => (
          <Link key={p.id} href={`/portfolios/${p.id}`} className="card" style={{ padding: 24, display: 'block', transition: 'border-color 0.2s' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontWeight: 700 }}>{p.name}</h3>
              <span className={`badge ${p.is_retired ? 'badge-gray' : 'badge-green'}`}>
                {p.is_retired ? 'Retired' : 'Active'}
              </span>
            </div>
            {p.note && <p className="text-sm text-muted mb-3">{p.note}</p>}
            <div className="text-xs text-muted">
              Reference account: {(p.accounts as unknown as { name: string } | null)?.name ?? 'None'}
            </div>
            <div className="text-xs text-muted mt-1">Updated {formatDate(p.updated_at)}</div>
          </Link>
        ))}
      </div>
    </>
  )
}
