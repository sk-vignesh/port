'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, TrendingUp, Wallet, Briefcase, ArrowLeftRight,
  Star, CalendarClock, Network, Settings, LogOut, ChevronRight
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Investments',
    items: [
      { href: '/securities', label: 'Securities', icon: TrendingUp },
      { href: '/portfolios', label: 'Portfolios', icon: Briefcase },
      { href: '/accounts', label: 'Accounts', icon: Wallet },
    ],
  },
  {
    label: 'Activity',
    items: [
      { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/plans', label: 'Investment Plans', icon: CalendarClock },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/watchlists', label: 'Watchlists', icon: Star },
      { href: '/taxonomies', label: 'Asset Allocation', icon: Network },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📈</div>
        <div>
          <div className="sidebar-logo-text">Portfolio</div>
          <div className="sidebar-logo-sub">Performance</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="sidebar-section-label">{group.label}</div>
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-item ${isActive(href) ? 'active' : ''}`}
              >
                <Icon className="sidebar-item-icon" size={18} />
                {label}
                {isActive(href) && (
                  <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link
          href="/settings"
          className={`sidebar-item ${pathname === '/settings' ? 'active' : ''}`}
          style={{ margin: '0 0 4px' }}
        >
          <Settings size={18} className="sidebar-item-icon" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="sidebar-item"
          style={{ width: '100%', background: 'none', border: 'none', margin: 0, color: 'var(--color-danger)', opacity: 0.8 }}
        >
          <LogOut size={18} className="sidebar-item-icon" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
