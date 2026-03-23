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

  // Verify portfolio belongs to user
  const { data: port } = await supabase.from('portfolios').select('id')
    .eq('id', portfolio_id).eq('user_id', user.id).maybeSingle()
  if (!port) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

  let imported = 0, skipped = 0, newSecs = 0
  const errors: string[] = []

  for (const t of trades) {
    try {
      const { symbol, isin, date, type, qty, price, trade_id } = t
      if (!symbol || !qty || !price || !date) { skipped++; continue }

      const idemKey = `zerodha:csv:${trade_id || `${symbol}-${date}-${type}-${qty}`}`

      // Idempotency check
      const { data: existing } = await supabase.from('portfolio_transactions')
        .select('id').eq('portfolio_id', portfolio_id).eq('note', idemKey).maybeSingle()
      if (existing) { skipped++; continue }

      // Find or create security
      let secId: string | null = null
      if (isin) {
        const { data: byIsin } = await supabase.from('securities').select('id')
          .eq('user_id', user.id).eq('isin', isin).maybeSingle()
        secId = byIsin?.id ?? null
      }
      if (!secId) {
        const { data: byTicker } = await supabase.from('securities').select('id')
          .eq('user_id', user.id).eq('ticker_symbol', symbol.toUpperCase()).maybeSingle()
        secId = byTicker?.id ?? null
      }
      if (!secId) {
        const { data: newSec } = await supabase.from('securities').insert({
          user_id: user.id, name: symbol.toUpperCase(),
          ticker_symbol: symbol.toUpperCase(), isin: isin || null,
          currency_code: CURRENCY, is_retired: false,
        }).select('id').single()
        secId = newSec?.id ?? null
        newSecs++
      }
      if (!secId) { errors.push(`Could not create security for ${symbol}`); continue }

      await supabase.from('portfolio_transactions').insert({
        portfolio_id,
        security_id:   secId,
        type:          type === 'sell' ? 'SELL' : 'BUY',
        date:          date,
        currency_code: CURRENCY,
        shares:        Math.round(Number(qty) * SHARE_SCALE),
        amount:        Math.round(Number(qty) * Number(price) * PRICE_SCALE),
        note:          idemKey,
        source:        'zerodha_csv',
      })
      imported++
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ imported, skipped, new_securities: newSecs, errors })
}
