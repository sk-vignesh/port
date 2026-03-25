import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate } from '@/lib/format'
export const dynamic = 'force-dynamic'

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual', ANNUAL: 'Annual',
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-Weekly',
}

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: plans } = await supabase
    .from('investment_plans')
    .select('*, securities(name), portfolios(name), accounts(name)')
    .order('name')

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Investment Plans</h1>
          <p className="page-subtitle">Recurring savings plans and automatic investments</p>
        </div>
        <Link href="/plans/new" className="btn btn-primary">+ New Plan</Link>
      </div>

      {!plans?.length ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🗓️</div>
            <div className="empty-state-title">No investment plans yet</div>
            <div className="empty-state-text">
              Set up recurring investment plans (savings plans) to automatically track scheduled investments.
            </div>
            <Link href="/plans/new" className="btn btn-primary mt-4">Create Plan</Link>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {plans.map(plan => {
            // ── SIP progress calculation ─────────────────────────────────
            const start   = new Date(plan.start_date)
            const end     = plan.end_date ? new Date(plan.end_date) : null
            const now     = new Date()
            const msPerMonth = 30.44 * 24 * 3600 * 1000

            const monthsElapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / msPerMonth))
            const totalMonths   = end ? Math.ceil((end.getTime() - start.getTime()) / msPerMonth) : null
            const progress      = totalMonths ? Math.min(100, (monthsElapsed / totalMonths) * 100) : null
            const isOngoing     = !end || now < end

            // Estimated total invested (elapsed × amount per interval, rough)
            const payPerMonth   = plan.interval === 'QUARTERLY' ? plan.amount / 3
              : plan.interval === 'SEMI_ANNUAL' ? plan.amount / 6
              : plan.interval === 'ANNUAL' ? plan.amount / 12
              : plan.interval === 'WEEKLY' ? plan.amount * 4
              : plan.interval === 'BIWEEKLY' ? plan.amount * 2
              : plan.amount
            const estInvested   = Math.round(payPerMonth * monthsElapsed)
            const targetTotal   = totalMonths ? Math.round(payPerMonth * totalMonths) : null

            return (
              <div key={plan.id} className="card" style={{ padding: 24 }}>
                {/* Header */}
                <div className="flex-between mb-3">
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{plan.name}</h3>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                        {INTERVAL_LABELS[plan.interval] ?? plan.interval}
                      </span>
                      <span className={`badge ${isOngoing ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>
                        {isOngoing ? 'Active' : 'Ended'}
                      </span>
                      {plan.auto_generate && (
                        <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>Auto</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Per period</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{formatAmount(plan.amount, plan.currency_code)}</div>
                  </div>
                </div>

                {/* Progress bar (only for dated plans) */}
                {totalMonths && progress !== null && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      <span>{monthsElapsed} / {totalMonths} months</span>
                      <span>{Math.round(progress)}% complete</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-input)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>~Invested</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                      {formatAmount(estInvested, plan.currency_code)}
                    </div>
                  </div>
                  {targetTotal && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Target Total</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        {formatAmount(targetTotal, plan.currency_code)}
                      </div>
                    </div>
                  )}
                  {plan.fees ? (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Fees</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: '0.9rem' }}>{formatAmount(plan.fees, plan.currency_code)}</div>
                    </div>
                  ) : null}
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(plan.securities as unknown as { name: string } | null)?.name && (
                    <div className="text-sm"><span className="text-muted">Security: </span>
                      {(plan.securities as unknown as { name: string }).name}
                    </div>
                  )}
                  {(plan.portfolios as unknown as { name: string } | null)?.name && (
                    <div className="text-sm"><span className="text-muted">Portfolio: </span>
                      {(plan.portfolios as unknown as { name: string }).name}
                    </div>
                  )}
                  <div className="text-sm text-muted">
                    {formatDate(plan.start_date)}{end ? ` → ${formatDate(plan.end_date!)}` : ' · ongoing'}
                  </div>
                </div>

                <div className="flex flex-gap-2 mt-4">
                  <Link href={`/plans/${plan.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

