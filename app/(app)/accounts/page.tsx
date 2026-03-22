import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate } from '@/lib/format'
export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('name')

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Cash and brokerage accounts</p>
        </div>
        <Link href="/accounts/new" className="btn btn-primary">+ Add Account</Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!accounts?.length ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon">💳</div>
                    <div className="empty-state-title">No accounts yet</div>
                    <div className="empty-state-text">Create a cash or brokerage account to start recording transactions.</div>
                    <Link href="/accounts/new" className="btn btn-primary mt-4">Add Account</Link>
                  </div>
                </td></tr>
              ) : accounts.map(acc => (
                <tr key={acc.id}>
                  <td>
                    <Link href={`/accounts/${acc.id}`} style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>
                      {acc.name}
                    </Link>
                    {acc.note && <div className="text-xs text-muted">{acc.note}</div>}
                  </td>
                  <td><span className="badge badge-blue">{acc.currency_code}</span></td>
                  <td><span className={`badge ${acc.is_retired ? 'badge-gray' : 'badge-green'}`}>
                    {acc.is_retired ? 'Retired' : 'Active'}
                  </span></td>
                  <td className="text-xs text-muted">{formatDate(acc.updated_at)}</td>
                  <td><Link href={`/accounts/${acc.id}`} className="btn btn-icon btn-sm">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
