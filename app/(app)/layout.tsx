import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <TopBar email={user.email ?? null} />
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  )
}
