import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('name')

  const active  = accounts?.filter(a => !a.is_retired) ?? []
  const retired = accounts?.filter(a => a.is_retired)  ?? []

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">{active.length} active · {retired.length} retired</p>
        </div>
        <Link href="/accounts/new" className="btn btn-primary">+ Add Account</Link>
      </div>

      {!accounts?.length && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-title">No accounts yet</div>
            <div className="empty-state-text">Add a cash or brokerage account to record transactions.</div>
            <Link href="/accounts/new" className="btn btn-primary mt-4">Add Account</Link>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
          {active.map(acc => (
            <Link key={acc.id} href={`/accounts/${acc.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{
                padding: '20px 22px', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.12s',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent-light)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #14b8a633, #14b8a611)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}>💳</div>
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Active</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                  {acc.name}
                </div>
                {acc.note && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>{acc.note}</div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                  INR · Tap to view
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {retired.length > 0 && (
        <>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Retired
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {retired.map(acc => (
              <Link key={acc.id} href={`/accounts/${acc.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '16px 20px', opacity: 0.65, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{acc.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Retired</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
