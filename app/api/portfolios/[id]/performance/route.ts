import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  buildHoldings, enrichHoldings, buildSubPeriods,
  calcTTWROR, calcIRR, calcAnnualized, yearsBetween,
  totalCurrentValue, totalCostBasis,
  type CashFlow,
} from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portfolioId = params.id

  // 1. Fetch all portfolio transactions (oldest-first for FIFO/IRR)
  const { data: txs, error: txErr } = await supabase
    .from('portfolio_transactions')
    .select('*, securities(name, currency_code)')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: true })

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  const empty = { ttwror: 0, ttwrorAnnualized: 0, irr: null, absoluteGain: 0, investedCapital: 0, currentValue: 0, holdings: [], since: null, years: 0 }
  if (!txs?.length) return NextResponse.json(empty)

  const securityIds = [...new Set(txs.map(t => t.security_id))]

  // 2. Fetch all price history for these securities (for TTWROR sub-periods)
  const { data: allPrices } = await supabase
    .from('security_prices')
    .select('security_id, date, value')
    .in('security_id', securityIds)
    .order('date', { ascending: true })

  // 3. Build latest price map
  const priceMap = new Map<string, number>()
  for (const p of (allPrices ?? [])) {
    priceMap.set(p.security_id, p.value) // iterating asc → last write = latest
  }

  // 4. Holdings and current value
  const holdings   = buildHoldings(txs as never)
  const enriched   = enrichHoldings(holdings, priceMap)
  const currentVal  = totalCurrentValue(enriched)
  const costBasis   = totalCostBasis(enriched)
  const absGain     = currentVal - costBasis

  // 5. TTWROR via price-history sub-periods
  const snapshots = (allPrices ?? []).map(p => ({
    date: p.date.slice(0, 10),
    securityId: p.security_id,
    price: p.value,
  }))

  // Add today's prices as a synthetic snapshot
  const todayStr = new Date().toISOString().slice(0, 10)
  for (const [secId, price] of priceMap) {
    snapshots.push({ date: todayStr, securityId: secId, price })
  }

  const subPeriods = buildSubPeriods(snapshots, txs as never)
  const ttwror = subPeriods.length > 0
    ? calcTTWROR(subPeriods)
    : (costBasis > 0 ? absGain / costBasis : 0) // fallback: simple return

  // 6. IRR cash flows
  //    Buys = negative (cash out), sells = positive (cash in), final value = positive
  const cashFlows: CashFlow[] = [
    ...txs.map(tx => ({
      date: new Date(tx.date),
      amount: (['BUY', 'DELIVERY_INBOUND', 'TRANSFER_IN'].includes(tx.type))
        ? -tx.amount
        :  tx.amount,
    })),
    { date: new Date(), amount: currentVal },
  ]
  const irr = calcIRR(cashFlows)

  // 7. Annualise
  const since  = txs[0].date.slice(0, 10)
  const years  = yearsBetween(new Date(since), new Date())
  const ttwrorAnnualized = calcAnnualized(ttwror, years)

  return NextResponse.json({
    ttwror,
    ttwrorAnnualized,
    irr,
    absoluteGain: absGain,
    investedCapital: costBasis,
    currentValue: currentVal,
    since,
    years,
    holdings: enriched.map(h => ({
      securityId:    h.securityId,
      name:          h.name,
      currency:      h.currency,
      shares:        h.shares,
      costBasis:     h.costBasis,
      currentValue:  h.currentValue,
      currentPrice:  h.currentPrice,
      avgCostPerShare: h.avgCostPerShare,
      gain:          h.gain,
      gainPct:       h.gainPct,
    })),
  })
}
