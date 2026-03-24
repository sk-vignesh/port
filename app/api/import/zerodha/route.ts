import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const PRICE_SCALE = 100
const SHARE_SCALE = 100_000_000
const CURRENCY    = 'INR'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portfolio_id, trades } = await req.json()
  if (!portfolio_id || !Array.isArray(trades) || trades.length === 0)
    return NextResponse.json({ error: 'portfolio_id and trades[] required' }, { status: 400 })

  // ── Server-side validation ────────────────────────────────────────────────────
  const TODAY = new Date().toISOString().slice(0, 10)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const validationErrors: string[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validTrades = trades.filter((t: any, idx: number) => {
    const sym   = String(t.symbol ?? '').trim().toUpperCase()
    const date  = String(t.date ?? '').trim()
    const type  = String(t.type ?? '').trim().toLowerCase()
    const qty   = Number(t.qty)
    const price = Number(t.price)

    const issues: string[] = []
    if (!sym)                       issues.push('missing symbol')
    if (!DATE_RE.test(date))        issues.push(`invalid date "${date}"`)
    else if (date > TODAY)          issues.push(`future date ${date}`)
    if (!isFinite(qty)  || qty  <= 0) issues.push(`invalid qty ${qty}`)
    if (!isFinite(price)|| price <= 0) issues.push(`invalid price ${price}`)
    if (!['buy','sell'].includes(type)) issues.push(`unknown type "${type}"`)

    if (issues.length > 0) {
      validationErrors.push(`Row ${idx + 1} (${sym || '?'}): ${issues.join(', ')}`)
      return false
    }
    return true
  })

  if (validTrades.length === 0) {
    return NextResponse.json({
      imported: 0, skipped: 0, new_securities: 0,
      errors: [`All ${trades.length} rows failed validation`, ...validationErrors.slice(0, 10)],
    }, { status: 422 })
  }

  // Use validTrades for the rest of the pipeline (silently drops invalid rows)
  const pipelineTrades = validTrades

  // Verify portfolio belongs to user
  const { data: port } = await supabase.from('portfolios').select('id')
    .eq('id', portfolio_id).eq('user_id', user.id).maybeSingle()
  if (!port) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

  // ── Step 1: Batch-load existing securities ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const secIdMap = new Map<string, string>()  // isin OR uppercase-ticker → id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allIsins   = [...new Set(pipelineTrades.map((t: any) => t.isin).filter(Boolean))] as string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSymbols = [...new Set(pipelineTrades.map((t: any) => (t.symbol as string).toUpperCase()))]

  if (allIsins.length) {
    const { data } = await supabase.from('securities').select('id, isin, ticker_symbol')
      .eq('user_id', user.id).in('isin', allIsins as never[])
    for (const s of data ?? []) {
      if (s.isin)          secIdMap.set(s.isin,           s.id)
      if (s.ticker_symbol) secIdMap.set(s.ticker_symbol!, s.id)
    }
  }
  const missingSymbols = allSymbols.filter(sym => !secIdMap.has(sym))
  if (missingSymbols.length) {
    const { data } = await supabase.from('securities').select('id, ticker_symbol')
      .eq('user_id', user.id).in('ticker_symbol', missingSymbols as never[])
    for (const s of data ?? []) if (s.ticker_symbol) secIdMap.set(s.ticker_symbol!, s.id)
  }

  // ── Step 2: Batch-create missing securities ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needCreate = pipelineTrades.filter((t: any) => {
    const sym = (t.symbol as string).toUpperCase()
    return !secIdMap.has(sym) && !secIdMap.has(t.isin)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dedupedCreate = [...new Map(needCreate.map((t: any) => [(t.symbol as string).toUpperCase(), t])).values()] as any[]
  let newSecs = 0
  if (dedupedCreate.length) {
    const rows = dedupedCreate.map(t => ({
      user_id: user.id, name: (t.symbol as string).toUpperCase(),
      ticker_symbol: (t.symbol as string).toUpperCase(),
      isin: (t.isin as string) || null, currency_code: CURRENCY, is_retired: false,
    }))
    const { data: created } = await supabase.from('securities').insert(rows).select('id, ticker_symbol, isin')
    newSecs = created?.length ?? 0
    for (const s of created ?? []) {
      if (s.ticker_symbol) secIdMap.set(s.ticker_symbol!, s.id)
      if (s.isin)          secIdMap.set(s.isin!,           s.id)
    }
  }

  // ── Step 3: Idempotency — bulk check existing notes ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idemKeys: string[] = pipelineTrades.map((t: any) =>
    `zerodha:csv:${t.trade_id || `${t.symbol}-${t.date}-${t.type}-${t.qty}`}`)

  const { data: alreadyIn } = await supabase.from('portfolio_transactions').select('note')
    .eq('portfolio_id', portfolio_id).in('note', idemKeys as never[])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingKeys = new Set((alreadyIn ?? []).map((r: any) => r.note as string))

  // ── Step 4: Batch insert ───────────────────────────────────────────────────
  const toInsert: object[] = []
  const errors: string[] = [...validationErrors.slice(0, 5)]
  if (validationErrors.length > 5) errors.push(`...and ${validationErrors.length - 5} more validation issues`)
  let skipped = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < pipelineTrades.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t    = pipelineTrades[i] as any
    const idem = idemKeys[i]
    if (existingKeys.has(idem)) { skipped++; continue }

    const sym   = (t.symbol as string).toUpperCase()
    const secId = secIdMap.get(sym) ?? secIdMap.get(t.isin as string)
    if (!secId) { errors.push(`No security for ${t.symbol}`); continue }

    toInsert.push({
      portfolio_id, security_id: secId,
      type:          t.type === 'sell' ? 'SELL' : 'BUY',
      date:          t.date as string,
      currency_code: CURRENCY,
      shares:        Math.round(Number(t.qty)   * SHARE_SCALE),
      amount:        Math.round(Number(t.qty) * Number(t.price) * PRICE_SCALE),
      note:          idem,
      source:        'zerodha_csv',
    })
  }

  let imported = 0
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200)
    const { error } = await supabase.from('portfolio_transactions').insert(chunk as never)
    if (error) errors.push(error.message)
    else imported += chunk.length
  }

  return NextResponse.json({
    imported, skipped, new_securities: newSecs,
    validation_dropped: trades.length - validTrades.length,
    errors,
  })
}
