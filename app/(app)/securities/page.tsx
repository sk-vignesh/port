import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SecuritiesGrid from './SecuritiesGrid'
export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: securities } = await supabase
    .from('securities')
    .select('id, name, ticker_symbol, isin, wkn, currency_code, is_retired, updated_at, security_latest_prices(value, previous_close, date)')
    .order('name')

  const rows = (securities ?? []).map(s => {
    const lp = s.security_latest_prices as unknown as { value: number; previous_close: number | null; date: string } | null
    const change = lp?.previous_close
      ? ((lp.value - lp.previous_close) / lp.previous_close) * 100
      : null
    return {
      id:          s.id,
      name:        s.name,
      ticker:      s.ticker_symbol ?? '',
      isin:        s.isin ?? '',
      currency:    s.currency_code,
      price:       lp ? lp.value / 100 : null,
      priceDate:   lp?.date ?? '',
      change1d:    change,
      status:      s.is_retired ? 'Retired' : 'Active',
      updated:     s.updated_at?.slice(0, 10) ?? '',
    }
  })

  const active  = rows.filter(r => r.status === 'Active').length
  const retired = rows.filter(r => r.status === 'Retired').length

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Securities</h1>
          <p className="page-subtitle">{active} active · {retired} retired</p>
        </div>
        <Link href="/securities/new" className="btn btn-primary">+ Add Security</Link>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">No securities yet</div>
            <div className="empty-state-text">Add your first trade — securities are created automatically.</div>
            <Link href="/transactions/new" className="btn btn-primary mt-4">Record First Trade</Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <SecuritiesGrid rows={rows} />
        </div>
      )}
    </>
  )
}
