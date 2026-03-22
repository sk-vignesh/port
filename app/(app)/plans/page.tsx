import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate } from '@/lib/format'

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
          {plans.map(plan => (
            <div key={plan.id} className="card" style={{ padding: 24 }}>
              <div className="flex-between mb-3">
                <h3 style={{ fontWeight: 700 }}>{plan.name}</h3>
                <span className="badge badge-blue">{INTERVAL_LABELS[plan.interval] ?? plan.interval}</span>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="metric-label">Amount</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {formatAmount(plan.amount, plan.currency_code)}
                  </div>
                </div>
                {plan.fees ? (
                  <div>
                    <div className="metric-label">Fees</div>
                    <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                      {formatAmount(plan.fees, plan.currency_code)}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(plan.securities as unknown as { name: string } | null)?.name && (
                  <div className="text-sm"><span className="text-muted">Security:</span>{' '}
                    {(plan.securities as unknown as { name: string }).name}
                  </div>
                )}
                {(plan.portfolios as unknown as { name: string } | null)?.name && (
                  <div className="text-sm"><span className="text-muted">Portfolio:</span>{' '}
                    {(plan.portfolios as unknown as { name: string }).name}
                  </div>
                )}
                {(plan.accounts as unknown as { name: string } | null)?.name && (
                  <div className="text-sm"><span className="text-muted">Account:</span>{' '}
                    {(plan.accounts as unknown as { name: string }).name}
                  </div>
                )}
                <div className="text-sm text-muted">
                  From {formatDate(plan.start_date)}
                  {plan.end_date ? ` → ${formatDate(plan.end_date)}` : ' · ongoing'}
                </div>
              </div>
              <div className="flex flex-gap-2 mt-4">
                <Link href={`/plans/${plan.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                {plan.auto_generate && <span className="badge badge-green">Auto-generate</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
