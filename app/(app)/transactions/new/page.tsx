import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Smart redirect — finds the user's default "Stocks" portfolio (or first portfolio)
 * and goes straight to its trade form, forwarding any query params (type, security_id).
 */
export default async function TransactionsNewRedirect({
  searchParams,
}: {
  searchParams: { type?: string; security_id?: string }
}) {
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

  // Forward query params so type=BUY/SELL and security_id are pre-selected
  const qs = new URLSearchParams()
  if (searchParams.type)        qs.set('type',        searchParams.type)
  if (searchParams.security_id) qs.set('security_id', searchParams.security_id)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  redirect(`/portfolios/${defaultPortfolio.id}/transactions/new${suffix}`)
}

