import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// /transactions/new redirects to /portfolios so user picks the right context
export default async function TransactionsNewRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  redirect('/portfolios')
}
