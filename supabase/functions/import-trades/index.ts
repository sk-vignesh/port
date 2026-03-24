/**
 * Supabase Edge Function: import-trades
 *
 * POST /functions/v1/import-trades
 * Body: { portfolio_id: string; account_id?: string; trades: ParsedTrade[] }
 *
 * Unified broker import pipeline (all brokers). Validates, deduplicates,
 * auto-creates missing securities, and inserts portfolio_transactions.
 *
 * Auth: Bearer <supabase_jwt>
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, json } from '../_shared/cors.ts'

const PRICE_SCALE = 100
const SHARE_SCALE = 100_000_000
const CURRENCY    = 'INR'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  // ── Auth check ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { portfolio_id?: string; account_id?: string; trades?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { portfolio_id, account_id, trades } = body
  if (!portfolio_id || !Array.isArray(trades) || trades.length === 0)
    return json({ error: 'portfolio_id and trades[] required' }, 400)

  // ── Server-side validation ──────────────────────────────────────────────────
  const TODAY = new Date().toISOString().slice(0, 10)
  const validationErrors: string[] = []

  // deno-lint-ignore no-explicit-any
  const validTrades = trades.filter((t: any, idx: number) => {
    const sym   = String(t.symbol ?? '').trim().toUpperCase()
    const date  = String(t.date   ?? '').trim()
    const type  = String(t.type   ?? '').trim().toLowerCase()
    const qty   = Number(t.qty)
    const price = Number(t.price)
    const issues: string[] = []

    if (!sym)                              issues.push('missing symbol')
    if (!DATE_RE.test(date))               issues.push(`invalid date "${date}"`)
    else if (date > TODAY)                 issues.push(`future date ${date}`)
    if (!isFinite(qty)   || qty   <= 0)   issues.push(`invalid qty ${qty}`)
    if (!isFinite(price) || price <= 0)   issues.push(`invalid price ${price}`)
    if (!['buy','sell'].includes(type))    issues.push(`unknown type "${type}"`)

    if (issues.length > 0) {
      validationErrors.push(`Row ${idx + 1} (${sym || '?'}): ${issues.join(', ')}`)
      return false
    }
    return true
  })

  if (validTrades.length === 0) {
    return json({
      imported: 0, skipped: 0, new_securities: 0,
      errors: [`All ${trades.length} rows failed validation`, ...validationErrors.slice(0, 10)],
    }, 422)
  }

  // ── Verify portfolio ownership ──────────────────────────────────────────────
  const { data: port } = await supabase.from('portfolios').select('id')
    .eq('id', portfolio_id).eq('user_id', user.id).maybeSingle()
  if (!port) return json({ error: 'Portfolio not found' }, 404)

  // ── Step 1: Batch-load existing securities ──────────────────────────────────
  const secIdMap = new Map<string, string>()

  // deno-lint-ignore no-explicit-any
  const allIsins   = [...new Set(validTrades.map((t: any) => t.isin).filter(Boolean))] as string[]
  // deno-lint-ignore no-explicit-any
  const allSymbols = [...new Set(validTrades.map((t: any) => (t.symbol as string).toUpperCase()))]

  if (allIsins.length) {
    const { data } = await supabase.from('securities')
      .select('id, isin, ticker_symbol')
      .eq('user_id', user.id).in('isin', allIsins)
    // deno-lint-ignore no-explicit-any
    for (const s of (data ?? []) as any[]) {
      if (s.isin)          secIdMap.set(s.isin,           s.id)
      if (s.ticker_symbol) secIdMap.set(s.ticker_symbol,  s.id)
    }
  }

  const missingSymbols = allSymbols.filter(sym => !secIdMap.has(sym))
  if (missingSymbols.length) {
    const { data } = await supabase.from('securities')
      .select('id, ticker_symbol')
      .eq('user_id', user.id).in('ticker_symbol', missingSymbols)
    // deno-lint-ignore no-explicit-any
    for (const s of (data ?? []) as any[]) if (s.ticker_symbol) secIdMap.set(s.ticker_symbol, s.id)
  }

  // ── Step 2: Create missing securities ──────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const needCreate = validTrades.filter((t: any) =>
    !secIdMap.has((t.symbol as string).toUpperCase()) && !secIdMap.has(t.isin)
  )
  const dedupMap = new Map<string, unknown>()
  // deno-lint-ignore no-explicit-any
  for (const t of needCreate as any[]) dedupMap.set((t.symbol as string).toUpperCase(), t)
  const dedupedCreate = [...dedupMap.values()] as { symbol: string; isin?: string }[]

  let newSecs = 0
  if (dedupedCreate.length) {
    const rows = dedupedCreate.map(t => ({
      user_id:       user.id,
      name:          t.symbol.toUpperCase(),
      ticker_symbol: t.symbol.toUpperCase(),
      isin:          t.isin ?? null,
      currency_code: CURRENCY,
      is_retired:    false,
    }))
    const { data: created } = await supabase.from('securities').insert(rows).select('id, ticker_symbol, isin')
    newSecs = created?.length ?? 0
    // deno-lint-ignore no-explicit-any
    for (const s of (created ?? []) as any[]) {
      if (s.ticker_symbol) secIdMap.set(s.ticker_symbol, s.id)
      if (s.isin)          secIdMap.set(s.isin, s.id)
    }
  }

  // ── Step 3: Idempotency check ───────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const idemKeys: string[] = validTrades.map((t: any) =>
    `import:csv:${t.trade_id || `${t.symbol}-${t.date}-${t.type}-${t.qty}`}`)

  const { data: alreadyIn } = await supabase.from('portfolio_transactions')
    .select('note').eq('portfolio_id', portfolio_id).in('note', idemKeys)
  // deno-lint-ignore no-explicit-any
  const existingKeys = new Set((alreadyIn ?? []).map((r: any) => r.note as string))

  // ── Step 4: Batch insert ────────────────────────────────────────────────────
  const toInsert: object[] = []
  const errors: string[] = [
    ...validationErrors.slice(0, 3),
    ...(validationErrors.length > 3 ? [`...and ${validationErrors.length - 3} more`] : []),
  ]
  let skipped = 0

  // deno-lint-ignore no-explicit-any
  for (let i = 0; i < validTrades.length; i++) {
    // deno-lint-ignore no-explicit-any
    const t    = validTrades[i] as any
    const idem = idemKeys[i]
    if (existingKeys.has(idem)) { skipped++; continue }

    const sym   = (t.symbol as string).toUpperCase()
    const secId = secIdMap.get(sym) ?? secIdMap.get(t.isin as string)
    if (!secId) { errors.push(`No security for ${t.symbol}`); continue }

    const row: Record<string, unknown> = {
      portfolio_id,
      security_id:   secId,
      type:          t.type === 'sell' ? 'SELL' : 'BUY',
      date:          t.date as string,
      currency_code: CURRENCY,
      shares:        Math.round(Number(t.qty)   * SHARE_SCALE),
      amount:        Math.round(Number(t.qty) * Number(t.price) * PRICE_SCALE),
      note:          idem,
      source:        'import_csv',
    }
    if (account_id) row.account_id = account_id
    toInsert.push(row)
  }

  let imported = 0
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200)
    const { error } = await supabase.from('portfolio_transactions').insert(chunk)
    if (error) errors.push(error.message)
    else imported += chunk.length
  }

  return json({
    imported,
    skipped,
    new_securities:      newSecs,
    validation_dropped:  trades.length - validTrades.length,
    errors,
  })
})
