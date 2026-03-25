import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import QuickTradeButton from '@/components/QuickTradeButton'
import ClientOnboardingGate from '@/components/ClientOnboardingGate'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Check onboarding status — upsert ensures the row always exists
  const { data: settings } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('onboarding_completed')
    .single()

  const showOnboarding = !((settings as unknown as { onboarding_completed?: boolean })?.onboarding_completed ?? false)

  return (
    <div className="app-shell">
      <ClientOnboardingGate showOnboarding={showOnboarding} />
      <Sidebar />
      <main className="main-content">
        <TopBar email={user.email ?? null} />
        <div className="page-container">
          {children}
        </div>
        <QuickTradeButton />
      </main>
    </div>
  )
}

