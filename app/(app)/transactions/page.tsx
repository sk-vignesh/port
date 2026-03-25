import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ACCOUNT_TX_LABELS, PORTFOLIO_TX_LABELS } from '@/lib/format'
import TransactionsClient from './TransactionsClient'
import type { TxRow } from '@/components/grids/TransactionsGrid'
export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: accounts }  = await supabase.from('accounts').select('id').eq('is_retired', false)
  const { data: portfolios } = await supabase.from('portfolios').select('id').eq('is_retired', false)

  const [{ data: acctTxns }, { data: portTxns }] = await Promise.all([
    supabase.from('account_transactions')
      .select('*, accounts(name), securities(id, name)')
      .in('account_id', (accounts ?? []).map(a => a.id))
      .order('date', { ascending: false })
      .limit(500),
    supabase.from('portfolio_transactions')
      .select('*, portfolios(name), securities(id, name)')
      .in('portfolio_id', (portfolios ?? []).map(p => p.id))
      .order('date', { ascending: false })
      .limit(500),
  ])

  const rows: TxRow[] = [
    ...(acctTxns ?? []).map(t => ({
      id:               `a-${t.id}`,
      date:             t.date,
      kind:             'account' as const,
      type:             t.type,
      type_label:       ACCOUNT_TX_LABELS[t.type] ?? t.type,
      security_id:      (t.securities as unknown as { id: string; name: string } | null)?.id ?? null,
      security_name:    (t.securities as unknown as { id: string; name: string } | null)?.name ?? null,
      account_portfolio:(t.accounts  as unknown as { name: string } | null)?.name ?? null,
      shares:           null,
      amount:           t.amount,
    })),
    ...(portTxns ?? []).map(t => ({
      id:               `p-${t.id}`,
      date:             t.date,
      kind:             'portfolio' as const,
      type:             t.type,
      type_label:       PORTFOLIO_TX_LABELS[t.type] ?? t.type,
      security_id:      (t.securities as unknown as { id: string; name: string } | null)?.id ?? null,
      security_name:    (t.securities as unknown as { id: string; name: string } | null)?.name ?? null,
      account_portfolio:(t.portfolios as unknown as { name: string } | null)?.name ?? null,
      shares:           t.shares ? t.shares / 100_000_000 : null,
      amount:           t.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return <TransactionsClient rows={rows} />
}
