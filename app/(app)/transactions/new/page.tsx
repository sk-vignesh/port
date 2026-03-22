import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Smart redirect — finds the user's default "Stocks" portfolio (or first portfolio)
 * and goes straight to its trade form. If no portfolio exists, sends to /portfolios.
 */
export default async function TransactionsNewRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('is_retired', false)
    .order('created_at', { ascending: true })

  if (!portfolios?.length) redirect('/portfolios')

  // Prefer "Stocks" portfolio, otherwise take the first one
  const defaultPortfolio =
    portfolios.find(p => p.name === 'Stocks') ?? portfolios[0]

  redirect(`/portfolios/${defaultPortfolio.id}/transactions/new`)
}
