import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, formatDate, formatShares } from '@/lib/format'
import SecurityDetailClient from './SecurityDetailClient'
export const dynamic = 'force-dynamic'

export default async function SecurityDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: security },
    { data: txnsRaw },
  ] = await Promise.all([
    supabase
      .from('securities')
      .select('*, security_latest_prices(*), security_events(*), security_prices(date, value)')
      .eq('id', id)
      .single(),
    // All portfolio transactions for this security across all portfolios
    supabase
      .from('portfolio_transactions')
      .select('id, portfolio_id, type, date, shares, amount, currency_code, note, portfolios(name)')
      .eq('security_id', id)
      .in('portfolio_id', (await supabase.from('portfolios').select('id').eq('user_id', user.id)).data?.map(p => p.id) ?? [])
      .order('date', { ascending: false }),
  ])

  if (!security) notFound()

  const prices = (security.security_prices as unknown as { date: string; value: number }[] ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
  const events = (security.security_events as unknown as { id: string; date: string; type: string; details: Record<string, unknown>; note?: string }[] ?? [])
    .sort((a, b) => b.date.localeCompare(a.date))
  const latest = security.security_latest_prices as unknown as {
    value: number; previous_close: number | null; date: string; high: number | null; low: number | null
  } | null

  const change = latest?.previous_close
    ? ((latest.value - latest.previous_close) / latest.previous_close) * 100
    : null

  // Compute 7d and 30d price change from history
  const today = new Date().toISOString().slice(0, 10)
  const d7  = new Date(Date.now() - 7  * 864e5).toISOString().slice(0, 10)
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const closestBefore = (target: string) => prices.filter(p => p.date <= target).at(-1)
  const p7  = closestBefore(d7)
  const p30 = closestBefore(d30)
  const curr = latest?.value ?? 0
  const change7d  = p7  && curr ? ((curr - p7.value)  / p7.value)  * 100 : null
  const change30d = p30 && curr ? ((curr - p30.value) / p30.value) * 100 : null

  const txns = (txnsRaw ?? []).map(t => ({
    id: t.id,
    portfolio: (t.portfolios as unknown as { name: string } | null)?.name ?? '—',
    type: t.type,
    date: t.date.slice(0, 10),
    shares: t.shares / 100_000_000,
    price: t.amount / 100 / (t.shares / 100_000_000),
    amount: t.amount / 100,
    currency: t.currency_code,
    note: t.note ?? '',
  }))

  // Net holding
  const BUY_TYPES = new Set(['BUY', 'DELIVERY_INBOUND', 'TRANSFER_IN'])
  const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])
  const netShares = txns.reduce((acc, t) => {
    if (BUY_TYPES.has(t.type))  return acc + t.shares
    if (SELL_TYPES.has(t.type)) return acc - t.shares
    return acc
  }, 0)
  const currentValue = latest && netShares > 0 ? (netShares * latest.value / 100) : null

  // Average buy price
  const buys = txns.filter(t => BUY_TYPES.has(t.type))
  const avgBuyPrice = buys.length > 0
    ? buys.reduce((acc, t) => acc + t.amount, 0) / buys.reduce((acc, t) => acc + t.shares, 0)
    : null
  const unrealisedPl = avgBuyPrice && latest && netShares > 0
    ? (latest.value / 100 - avgBuyPrice) * netShares
    : null

  return (
    <>
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/securities" style={{ color: 'var(--color-accent-light)' }}>Securities</Link>
            {' / '}{security.name}
          </div>
          <h1 className="page-title">{security.name}</h1>
          <div className="flex flex-gap-2 mt-2">
            {security.ticker_symbol && <span className="badge badge-blue">{security.ticker_symbol}</span>}
            {security.isin && <span className="badge badge-gray font-mono">{security.isin}</span>}
            <span className="badge badge-purple">{security.currency_code}</span>
            {security.is_retired && <span className="badge badge-gray">Retired</span>}
          </div>
        </div>
        <div className="flex flex-gap-3 items-center">
          {latest && (
            <div className="text-right">
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                {formatAmount(latest.value / 100, security.currency_code)}
              </div>
              {change !== null && (
                <div className={`text-sm font-mono ${change >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                </div>
              )}
              <div className="text-xs text-muted">{formatDate(latest.date)}</div>
            </div>
          )}
          <div className="flex flex-gap-2">
            <Link href={`/securities/${id}/events/new`} className="btn btn-secondary btn-sm">+ Event</Link>
            <Link href={`/securities/${id}/prices`} className="btn btn-secondary btn-sm">Prices</Link>
            <Link href={`/securities/${id}/edit`} className="btn btn-secondary">Edit</Link>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Current Price',  value: latest ? formatAmount(latest.value / 100, security.currency_code) : '—' },
          { label: 'Today',          value: change     !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`     : '—', cls: change     !== null ? (change >= 0 ? 'amount-positive' : 'amount-negative') : '' },
          { label: '1 Week',         value: change7d   !== null ? `${change7d >= 0 ? '+' : ''}${change7d.toFixed(2)}%`   : '—', cls: change7d   !== null ? (change7d >= 0 ? 'amount-positive' : 'amount-negative') : '' },
          { label: '1 Month',        value: change30d  !== null ? `${change30d >= 0 ? '+' : ''}${change30d.toFixed(2)}%`  : '—', cls: change30d  !== null ? (change30d >= 0 ? 'amount-positive' : 'amount-negative') : '' },
          { label: 'Net Holding',    value: netShares > 0 ? `${Math.round(netShares)} shares` : '—' },
          { label: 'Current Value',  value: currentValue !== null ? formatAmount(currentValue, security.currency_code) : '—' },
          { label: 'Avg Buy Price',  value: avgBuyPrice !== null ? formatAmount(avgBuyPrice, security.currency_code) : '—' },
          { label: 'Unrealised P&L', value: unrealisedPl !== null ? formatAmount(unrealisedPl, security.currency_code) : '—', cls: unrealisedPl !== null ? (unrealisedPl >= 0 ? 'amount-positive' : 'amount-negative') : '' },
        ].map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className={`metric-value ${m.cls ?? ''}`} style={{ fontSize: '1rem' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Client section: chart + grids */}
      <SecurityDetailClient
        securityId={id}
        currency={security.currency_code}
        prices={prices.map(p => ({ date: p.date, value: p.value / 100 }))}
        transactions={txns}
        events={events}
      />

      {security.note && (
        <div className="card mt-4">
          <div className="card-header"><span className="card-title">Notes</span></div>
          <div className="card-body">
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>{security.note}</p>
          </div>
        </div>
      )}
    </>
  )
}
