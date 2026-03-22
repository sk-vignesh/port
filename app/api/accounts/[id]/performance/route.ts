import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calcIRR, calcAnnualized, yearsBetween, type CashFlow } from '@/lib/performance'

export const dynamic = 'force-dynamic'

const INFLOW_TYPES  = new Set(['DEPOSIT', 'INTEREST', 'DIVIDENDS', 'FEES_REFUND', 'TAX_REFUND', 'TRANSFER_IN'])
const OUTFLOW_TYPES = new Set(['REMOVAL', 'FEES', 'TAXES', 'INTEREST_CHARGE', 'TRANSFER_OUT'])

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: txs, error } = await supabase
    .from('account_transactions')
    .select('*')
    .eq('account_id', params.id)
    .order('date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!txs?.length) {
    return NextResponse.json({ balance: 0, totalDeposited: 0, totalWithdrawn: 0, totalInterest: 0, totalDividends: 0, irr: null, since: null })
  }

  let balance       = 0
  let totalDeposited  = 0
  let totalWithdrawn  = 0
  let totalInterest   = 0
  let totalDividends  = 0

  const cashFlows: CashFlow[] = []

  for (const tx of txs) {
    const date = new Date(tx.date)
    if (tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN') {
      balance += tx.amount; totalDeposited += tx.amount
      cashFlows.push({ date, amount: -tx.amount }) // outflow from investor's perspective
    } else if (tx.type === 'REMOVAL' || tx.type === 'TRANSFER_OUT') {
      balance -= tx.amount; totalWithdrawn += tx.amount
      cashFlows.push({ date, amount: tx.amount })
    } else if (tx.type === 'INTEREST') {
      balance += tx.amount; totalInterest += tx.amount
    } else if (tx.type === 'DIVIDENDS') {
      balance += tx.amount; totalDividends += tx.amount
    } else if (tx.type === 'FEES' || tx.type === 'TAXES') {
      balance -= tx.amount
    } else if (tx.type === 'BUY') {
      balance -= tx.amount
    } else if (tx.type === 'SELL') {
      balance += tx.amount
    }
  }

  // Final balance as inflow to investor
  cashFlows.push({ date: new Date(), amount: balance })
  const irr = calcIRR(cashFlows)
  const since = txs[0].date.slice(0, 10)
  const years = yearsBetween(new Date(since), new Date())
  const irrAnnualized = irr != null ? calcAnnualized(irr, years) : null

  return NextResponse.json({
    balance, totalDeposited, totalWithdrawn,
    totalInterest, totalDividends,
    irr, irrAnnualized, since, years,
  })
}
