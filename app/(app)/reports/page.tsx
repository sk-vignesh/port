import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v)

const pct = (v: number | null) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

const pctColor = (v: number | null) =>
  v === null ? '' : v >= 0 ? 'amount-positive' : 'amount-negative'

function closestPrice(map: Map<string, { date: string; value: number }[]>, secId: string, daysAgo: number): number | null {
  const rows = map.get(secId)
  if (!rows?.length) return null
  const target = new Date(); target.setDate(target.getDate() - daysAgo)
  // find the most recent price at or before target date
  const iso = target.toISOString().slice(0, 10)
  const valid = rows.filter(r => r.date <= iso)
  return valid.length ? valid[0].value / 100 : null
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Holding {
  secId: string; name: string; ticker: string | null; currency: string
  currentPrice: number | null; previousClose: number | null
  netShares: number; currentValue: number | null
}

interface PeriodChange { value: number; change1d: number | null; change1w: number | null; change1m: number | null }

function aggregateChange(holdings: Holding[], histMap: Map<string, { date: string; value: number }[]>): PeriodChange {
  let value = 0, val1d = 0, val1w = 0, val1m = 0, has1d = true, has1w = true, has1m = true
  for (const h of holdings) {
    if (h.currentValue === null || h.netShares <= 0) continue
    value += h.currentValue
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

// ─── component ────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const [
    { data: portfoliosRaw },
    { data: txnsRaw },
    { data: securitiesRaw },
    { data: latestPricesRaw },
    { data: histPricesRaw },
    { data: taxonomiesRaw },
    { data: classificationsRaw },
    { data: assignmentsRaw },
  ] = await Promise.all([
    supabase.from('portfolios').select('id, name').eq('user_id', user.id).eq('is_retired', false),
    supabase.from('portfolio_transactions').select('portfolio_id, security_id, type, shares').in(
      'portfolio_id',
      (await supabase.from('portfolios').select('id').eq('user_id', user.id).eq('is_retired', false)).data?.map(p => p.id) ?? []
    ),
    supabase.from('securities').select('id, name, ticker_symbol, currency_code').eq('user_id', user.id).eq('is_retired', false),
    supabase.from('security_latest_prices').select('security_id, value, previous_close').in(
      'security_id',
      (await supabase.from('securities').select('id').eq('user_id', user.id).eq('is_retired', false)).data?.map(s => s.id) ?? []
    ),
    // last 35 days of prices for 1w/1m lookups
    supabase.from('security_prices').select('security_id, date, value').in(
      'security_id',
      (await supabase.from('securities').select('id').eq('user_id', user.id).eq('is_retired', false)).data?.map(s => s.id) ?? []
    ).gte('date', new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10)).order('date', { ascending: false }),
    supabase.from('taxonomies').select('id, name').eq('user_id', user.id).order('sort_order'),
    supabase.from('classifications').select('id, taxonomy_id, name, color').in(
      'taxonomy_id',
      (await supabase.from('taxonomies').select('id').eq('user_id', user.id)).data?.map(t => t.id) ?? []
    ),
    supabase.from('classification_assignments').select('classification_id, investment_vehicle_id, investment_vehicle_type, weight').eq('investment_vehicle_type', 'SECURITY'),
  ])

  const portfolios = portfoliosRaw ?? []
  const txns = txnsRaw ?? []
  const securities = securitiesRaw ?? []
  const latestPrices = latestPricesRaw ?? []
  const histPrices = histPricesRaw ?? []
  const taxonomies = taxonomiesRaw ?? []
  const classifications = classificationsRaw ?? []
  const assignments = assignmentsRaw ?? []

  // ── Index maps ────────────────────────────────────────────────────────────
  const secMap = new Map(securities.map(s => [s.id, s]))
  const latestMap = new Map(latestPrices.map(p => [p.security_id, p]))

  // hist prices per security, sorted desc
  const histMap = new Map<string, { date: string; value: number }[]>()
  for (const hp of histPrices) {
    if (!histMap.has(hp.security_id)) histMap.set(hp.security_id, [])
    histMap.get(hp.security_id)!.push({ date: hp.date, value: hp.value })
  }

  // ── Net shares per (portfolio, security) ─────────────────────────────────
  const BUY_TYPES  = new Set(['BUY', 'DELIVERY_INBOUND', 'TRANSFER_IN'])
  const SELL_TYPES = new Set(['SELL', 'DELIVERY_OUTBOUND', 'TRANSFER_OUT'])

  type Key = string // `${portfolioId}::${securityId}`
  const netSharesMap = new Map<Key, number>()
  for (const tx of txns) {
    const key = `${tx.portfolio_id}::${tx.security_id}`
    const cur = netSharesMap.get(key) ?? 0
    const shares = tx.shares / 100_000_000
    if (BUY_TYPES.has(tx.type))  netSharesMap.set(key, cur + shares)
    if (SELL_TYPES.has(tx.type)) netSharesMap.set(key, cur - shares)
  }

  // ── Build holdings list ───────────────────────────────────────────────────
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
      const currentPrice = lp ? lp.value / 100 : null
      const previousClose = lp?.previous_close ? lp.previous_close / 100 : null
      const currentValue = currentPrice !== null ? netShares * currentPrice : null
      result.push({ secId, name: sec.name, ticker: sec.ticker_symbol, currency: sec.currency_code, currentPrice, previousClose, netShares, currentValue })
    }
    return result.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
  }

  const allHoldings = buildHoldings()
  const overall = aggregateChange(allHoldings, histMap)

  const portfolioData = portfolios.map(p => ({
    ...p,
    holdings: buildHoldings(p.id),
    summary: aggregateChange(buildHoldings(p.id), histMap),
  }))

  // ── Taxonomy breakdown ────────────────────────────────────────────────────
  const classMap = new Map(classifications.map(c => [c.id, c]))
  const taxData = taxonomies.map(tax => {
    const taxClasses = classifications.filter(c => c.taxonomy_id === tax.id)
    const groups = taxClasses.map(cls => {
      const secIds = assignments
        .filter(a => a.classification_id === cls.id)
        .map(a => a.investment_vehicle_id)
      const holdings = allHoldings.filter(h => secIds.includes(h.secId))
      return { cls, holdings, summary: aggregateChange(holdings, histMap) }
    }).filter(g => g.holdings.length > 0)
    return { tax, groups }
  }).filter(t => t.groups.length > 0)

  // ── Render helpers ────────────────────────────────────────────────────────
  const ChangeRow = ({ label, s, sub = false }: { label: string; s: PeriodChange; sub?: boolean }) => (
    <tr style={{ background: sub ? 'transparent' : undefined }}>
      <td style={{ paddingLeft: sub ? 28 : 14, fontWeight: sub ? 400 : 600, fontSize: sub ? '0.82rem' : '0.875rem' }}>{label}</td>
      <td className="table-right font-mono text-sm">{s.value > 0 ? fmt(s.value) : '—'}</td>
      <td className={`table-right font-mono text-sm ${pctColor(s.change1d)}`}>{pct(s.change1d)}</td>
      <td className={`table-right font-mono text-sm ${pctColor(s.change1w)}`}>{pct(s.change1w)}</td>
      <td className={`table-right font-mono text-sm ${pctColor(s.change1m)}`}>{pct(s.change1m)}</td>
    </tr>
  )

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Performance Report</h1>
        <p className="page-subtitle">Portfolio changes across all time horizons and groupings</p>
      </div>

      {allHoldings.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No holdings yet</div>
            <div className="empty-state-text">Add trades to see performance reports.</div>
            <Link href="/transactions/new" className="btn btn-primary mt-4">Record First Trade</Link>
          </div>
        </div>
      )}

      {allHoldings.length > 0 && (
        <>
          {/* ── Summary hero ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Portfolio Value', value: fmt(overall.value), sub: null },
              { label: 'Today',    value: pct(overall.change1d), sub: overall.change1d },
              { label: '1 Week',   value: pct(overall.change1w), sub: overall.change1w },
              { label: '1 Month',  value: pct(overall.change1m), sub: overall.change1m },
            ].map(card => (
              <div key={card.label} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: '1.4rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
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
                    <th>Portfolio</th>
                    <th className="table-right">Value</th>
                    <th className="table-right">Today</th>
                    <th className="table-right">1 Week</th>
                    <th className="table-right">1 Month</th>
                  </tr></thead>
                  <tbody>
                    {portfolioData.map(p => <ChangeRow key={p.id} label={p.name} s={p.summary} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── By Taxonomy ── */}
          {taxData.map(({ tax, groups }) => (
            <div key={tax.id} className="card mb-6">
              <div className="card-header">
                <span className="card-title">By {tax.name}</span>
                <Link href="/taxonomies" className="btn btn-secondary btn-sm">Manage</Link>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead><tr>
                    <th>Category</th>
                    <th className="table-right">Value</th>
                    <th className="table-right">Today</th>
                    <th className="table-right">1 Week</th>
                    <th className="table-right">1 Month</th>
                  </tr></thead>
                  <tbody>
                    {groups.map(({ cls, summary }) => <ChangeRow key={cls.id} label={cls.name} s={summary} />)}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* ── By Security (all holdings) ── */}
          <div className="card mb-6">
            <div className="card-header"><span className="card-title">By Security</span></div>
            <div className="table-container">
              <table className="table">
                <thead><tr>
                  <th>Security</th>
                  <th className="table-right">Shares</th>
                  <th className="table-right">Price</th>
                  <th className="table-right">Value</th>
                  <th className="table-right">Today</th>
                  <th className="table-right">1 Week</th>
                  <th className="table-right">1 Month</th>
                </tr></thead>
                <tbody>
                  {allHoldings.filter(h => h.netShares > 0 && h.currentValue !== null).map(h => {
                    const lp = latestMap.get(h.secId)
                    const p1d = h.previousClose ?? h.currentPrice
                    const p1w = closestPrice(histMap, h.secId, 7) ?? h.currentPrice
                    const p1m = closestPrice(histMap, h.secId, 30) ?? h.currentPrice
                    const chg1d = p1d && h.currentPrice ? ((h.currentPrice - p1d) / p1d) * 100 : null
                    const chg1w = p1w && h.currentPrice ? ((h.currentPrice - p1w) / p1w) * 100 : null
                    const chg1m = p1m && h.currentPrice ? ((h.currentPrice - p1m) / p1m) * 100 : null
                    return (
                      <tr key={h.secId}>
                        <td>
                          <Link href={`/securities/${h.secId}`} style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>
                            {h.name}
                          </Link>
                          {h.ticker && <div className="font-mono text-xs text-muted">{h.ticker}</div>}
                        </td>
                        <td className="table-right font-mono text-sm">
                          {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(h.netShares)}
                        </td>
                        <td className="table-right font-mono text-sm">
                          {h.currentPrice !== null ? fmt(h.currentPrice, h.currency) : '—'}
                        </td>
                        <td className="table-right font-mono text-sm font-semibold">
                          {h.currentValue !== null ? fmt(h.currentValue, h.currency) : '—'}
                        </td>
                        <td className={`table-right font-mono text-sm ${pctColor(chg1d)}`}>{pct(chg1d)}</td>
                        <td className={`table-right font-mono text-sm ${pctColor(chg1w)}`}>{pct(chg1w)}</td>
                        <td className={`table-right font-mono text-sm ${pctColor(chg1m)}`}>{pct(chg1m)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Unclassified note ── */}
          {taxonomies.length === 0 && (
            <div className="card" style={{ borderStyle: 'dashed' }}>
              <div className="card-body text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                <div>
                  <strong>No taxonomies defined yet.</strong> Create taxonomies (e.g. Sector, Asset Class, Country) and assign securities to classifications to see grouped performance here.
                  <Link href="/taxonomies" style={{ color: 'var(--color-accent-light)', marginLeft: 8 }}>Manage Taxonomies →</Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
