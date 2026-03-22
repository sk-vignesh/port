import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtCur = (v: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v)

const pct = (v: number | null) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

const pctColor = (v: number | null) =>
  v === null ? '' : v >= 0 ? 'amount-positive' : 'amount-negative'

function closestPrice(
  map: Map<string, { date: string; value: number }[]>,
  secId: string, daysAgo: number
): number | null {
  const rows = map.get(secId)
  if (!rows?.length) return null
  const iso = new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10)
  const valid = rows.filter(r => r.date <= iso)
  return valid.length ? valid[0].value / 100 : null
}

interface Holding {
  secId: string; name: string; ticker: string | null; currency: string
  currentPrice: number | null; previousClose: number | null
  netShares: number; currentValue: number | null
}

interface PeriodChange { value: number; change1d: number | null; change1w: number | null; change1m: number | null }

function aggregateChange(holdings: Holding[], histMap: Map<string, { date: string; value: number }[]>): PeriodChange {
  let value = 0, val1d = 0, val1w = 0, val1m = 0, has1d = true, has1w = true, has1m = true
  for (const h of holdings) {
    if (h.netShares <= 0) continue
    const cur = h.currentValue ?? 0
    value += cur
    if (cur === 0) continue
    const p1d = h.previousClose ?? h.currentPrice
    const p1w = closestPrice(histMap, h.secId, 7) ?? h.currentPrice
    const p1m = closestPrice(histMap, h.secId, 30) ?? h.currentPrice
    if (p1d === null) has1d = false; else val1d += h.netShares * p1d
    if (p1w === null) has1w = false; else val1w += h.netShares * p1w
    if (p1m === null) has1m = false; else val1m += h.netShares * p1m
  }
  return {
    value,
    change1d: has1d && val1d > 0 ? ((value - val1d) / val1d) * 100 : null,
    change1w: has1w && val1w > 0 ? ((value - val1w) / val1w) * 100 : null,
    change1m: has1m && val1m > 0 ? ((value - val1m) / val1m) * 100 : null,
  }
}

const BUY_TYPES  = new Set(['BUY', 'DELIVERY_INBOUND', 'TRANSFER_IN'])
const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Step 1 — fetch IDs needed for dependent queries
  const [portfolioIdRows, securityIdRows, taxonomyIdRows] = await Promise.all([
    supabase.from('portfolios').select('id, name').eq('user_id', user.id).eq('is_retired', false),
    supabase.from('securities').select('id, name, ticker_symbol, currency_code').eq('user_id', user.id).eq('is_retired', false),
    supabase.from('taxonomies').select('id, name').eq('user_id', user.id).order('sort_order'),
  ])

  const portfolios = portfolioIdRows.data ?? []
  const securities = securityIdRows.data ?? []
  const taxonomies = taxonomyIdRows.data ?? []
  const portIds    = portfolios.map(p => p.id)
  const secIds     = securities.map(s => s.id)
  const taxIds     = taxonomies.map(t => t.id)

  // Step 2 — parallel fetch of everything using those IDs
  const [txnsRes, latestRes, histRes, classRes, assignRes] = await Promise.all([
    portIds.length > 0
      ? supabase.from('portfolio_transactions').select('portfolio_id, security_id, type, shares').in('portfolio_id', portIds)
      : Promise.resolve({ data: [] }),
    secIds.length > 0
      ? supabase.from('security_latest_prices').select('security_id, value, previous_close').in('security_id', secIds)
      : Promise.resolve({ data: [] }),
    secIds.length > 0
      ? supabase.from('security_prices').select('security_id, date, value')
          .in('security_id', secIds)
          .gte('date', new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10))
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
    taxIds.length > 0
      ? supabase.from('classifications').select('id, taxonomy_id, name, color').in('taxonomy_id', taxIds)
      : Promise.resolve({ data: [] }),
    supabase.from('classification_assignments')
      .select('classification_id, investment_vehicle_id')
      .eq('investment_vehicle_type', 'SECURITY'),
  ])

  const txns           = txnsRes.data   ?? []
  const latestPrices   = latestRes.data ?? []
  const histPrices     = histRes.data   ?? []
  const classifications = classRes.data ?? []
  const assignments    = assignRes.data ?? []

  // ── Index maps ──────────────────────────────────────────────────────────
  const secMap    = new Map(securities.map(s => [s.id, s]))
  const latestMap = new Map(latestPrices.map(p => [p.security_id, p]))

  const histMap = new Map<string, { date: string; value: number }[]>()
  for (const hp of histPrices) {
    if (!histMap.has(hp.security_id)) histMap.set(hp.security_id, [])
    histMap.get(hp.security_id)!.push({ date: hp.date, value: hp.value })
  }

  // ── Net shares per (portfolio, security) ────────────────────────────────
  const netSharesMap = new Map<string, number>()
  for (const tx of txns) {
    const key = `${tx.portfolio_id}::${tx.security_id}`
    const cur = netSharesMap.get(key) ?? 0
    const shares = tx.shares / 100_000_000
    if (BUY_TYPES.has(tx.type))  netSharesMap.set(key, cur + shares)
    if (SELL_TYPES.has(tx.type)) netSharesMap.set(key, cur - shares)
  }

  // ── Build holdings ───────────────────────────────────────────────────────
  function buildHoldings(portfolioId?: string): Holding[] {
    const result: Holding[] = []
    const seen = new Set<string>()
    for (const [key, netShares] of netSharesMap) {
      const [pId, secId] = key.split('::')
      if (portfolioId && pId !== portfolioId) continue
      if (netShares <= 0) continue
      const dedupKey = portfolioId ? key : secId
      if (!portfolioId && seen.has(dedupKey)) continue
      seen.add(dedupKey)
      const sec = secMap.get(secId)
      if (!sec) continue
      const lp = latestMap.get(secId)
      const currentPrice  = lp ? lp.value / 100 : null
      const previousClose = lp?.previous_close ? lp.previous_close / 100 : null
      const currentValue  = currentPrice !== null ? netShares * currentPrice : null
      result.push({ secId, name: sec.name, ticker: sec.ticker_symbol, currency: sec.currency_code, currentPrice, previousClose, netShares, currentValue })
    }
    return result.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
  }

  const allHoldings  = buildHoldings()
  const overall      = aggregateChange(allHoldings, histMap)
  const hasAnyTrades = allHoldings.length > 0

  const portfolioData = portfolios.map(p => ({
    ...p, summary: aggregateChange(buildHoldings(p.id), histMap),
  }))

  const taxData = taxonomies.map(tax => {
    const groups = classifications
      .filter(c => c.taxonomy_id === tax.id)
      .map(cls => {
        const secIds2 = assignments.filter(a => a.classification_id === cls.id).map(a => a.investment_vehicle_id)
        const holdings = allHoldings.filter(h => secIds2.includes(h.secId))
        return { cls, holdings, summary: aggregateChange(holdings, histMap) }
      }).filter(g => g.holdings.length > 0)
    return { tax, groups }
  }).filter(t => t.groups.length > 0)

  const ChangeRow = ({ label, s }: { label: string; s: PeriodChange }) => (
    <tr>
      <td style={{ paddingLeft: 14, fontWeight: 600, fontSize: '0.875rem' }}>{label}</td>
      <td className="table-right text-sm">{s.value > 0 ? fmtCur(s.value) : '—'}</td>
      <td className={`table-right text-sm ${pctColor(s.change1d)}`}>{pct(s.change1d)}</td>
      <td className={`table-right text-sm ${pctColor(s.change1w)}`}>{pct(s.change1w)}</td>
      <td className={`table-right text-sm ${pctColor(s.change1m)}`}>{pct(s.change1m)}</td>
    </tr>
  )

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Performance Report</h1>
        <p className="page-subtitle">Portfolio changes across all time horizons and groupings</p>
      </div>

      {!hasAnyTrades && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No holdings yet</div>
            <div className="empty-state-text">Add trades to see performance reports.</div>
            <Link href="/transactions/new" className="btn btn-primary mt-4">Record First Trade</Link>
          </div>
        </div>
      )}

      {hasAnyTrades && (
        <>
          {/* ── Hero cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Portfolio Value', value: overall.value > 0 ? fmtCur(overall.value) : '—', sub: null },
              { label: 'Today',   value: pct(overall.change1d), sub: overall.change1d },
              { label: '1 Week',  value: pct(overall.change1w), sub: overall.change1w },
              { label: '1 Month', value: pct(overall.change1m), sub: overall.change1m },
            ].map(card => (
              <div key={card.label} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: '1.35rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  color: card.sub === null ? 'var(--color-text-primary)'
                    : card.sub >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── By Portfolio ── */}
          {portfolioData.length > 1 && (
            <div className="card mb-6">
              <div className="card-header"><span className="card-title">By Portfolio</span></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr>
                    <th>Portfolio</th><th className="table-right">Value</th>
                    <th className="table-right">Today</th><th className="table-right">1 Week</th><th className="table-right">1 Month</th>
                  </tr></thead>
                  <tbody>{portfolioData.map(p => <ChangeRow key={p.id} label={p.name} s={p.summary} />)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── By Segment ── */}
          {taxData.map(({ tax, groups }) => (
            <div key={tax.id} className="card mb-6">
              <div className="card-header">
                <span className="card-title">By {tax.name}</span>
                <Link href="/taxonomies" className="btn btn-secondary btn-sm">Manage</Link>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead><tr>
                    <th>Category</th><th className="table-right">Value</th>
                    <th className="table-right">Today</th><th className="table-right">1 Week</th><th className="table-right">1 Month</th>
                  </tr></thead>
                  <tbody>{groups.map(({ cls, summary }) => <ChangeRow key={cls.id} label={cls.name} s={summary} />)}</tbody>
                </table>
              </div>
            </div>
          ))}

          {/* ── By Security ── */}
          <div className="card mb-6">
            <div className="card-header"><span className="card-title">By Security</span></div>
            <div className="table-container">
              <table className="table">
                <thead><tr>
                  <th>Security</th><th className="table-right">Shares</th>
                  <th className="table-right">Price</th><th className="table-right">Value</th>
                  <th className="table-right">Today</th><th className="table-right">1 Week</th><th className="table-right">1 Month</th>
                </tr></thead>
                <tbody>
                  {allHoldings.filter(h => h.netShares > 0).map(h => {
                    const p1d = h.previousClose ?? h.currentPrice
                    const p1w = closestPrice(histMap, h.secId, 7) ?? h.currentPrice
                    const p1m = closestPrice(histMap, h.secId, 30) ?? h.currentPrice
                    const chg1d = p1d && h.currentPrice ? ((h.currentPrice - p1d) / p1d) * 100 : null
                    const chg1w = p1w && h.currentPrice ? ((h.currentPrice - p1w) / p1w) * 100 : null
                    const chg1m = p1m && h.currentPrice ? ((h.currentPrice - p1m) / p1m) * 100 : null
                    return (
                      <tr key={h.secId}>
                        <td>
                          <Link href={`/securities/${h.secId}`} style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>{h.name}</Link>
                          {h.ticker && <div className="text-xs text-muted">{h.ticker}</div>}
                        </td>
                        <td className="table-right text-sm">{Math.round(h.netShares)}</td>
                        <td className="table-right text-sm">
                          {h.currentPrice !== null ? fmtCur(h.currentPrice, h.currency) : <span className="text-muted">No price</span>}
                        </td>
                        <td className="table-right text-sm font-semibold">
                          {h.currentValue !== null ? fmtCur(h.currentValue, h.currency) : '—'}
                        </td>
                        <td className={`table-right text-sm ${pctColor(chg1d)}`}>{pct(chg1d)}</td>
                        <td className={`table-right text-sm ${pctColor(chg1w)}`}>{pct(chg1w)}</td>
                        <td className={`table-right text-sm ${pctColor(chg1m)}`}>{pct(chg1m)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {taxonomies.length === 0 && (
            <div className="card" style={{ borderStyle: 'dashed' }}>
              <div className="card-body text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                <div>
                  <strong>No segments yet.</strong> Create Sector, Asset Class, Country etc. to group performance by category.
                  <Link href="/taxonomies" style={{ color: 'var(--color-accent-light)', marginLeft: 8 }}>Manage Segments →</Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
