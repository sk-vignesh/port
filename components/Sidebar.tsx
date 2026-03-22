'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, TrendingUp, Wallet, Briefcase, ArrowLeftRight,
  Star, CalendarClock, Network, PanelLeftClose, PanelLeftOpen, BarChart3,
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
      { href: '/plans', label: 'Plans', icon: CalendarClock },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/reports',    label: 'Reports',    icon: BarChart3 },
      { href: '/watchlists', label: 'Watchlists', icon: Star },
      { href: '/taxonomies', label: 'Taxonomies', icon: Network },
    ],
  },
]

// SVG logo mark
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#lg1)" />
      {/* Candlestick bars */}
      <rect x="6" y="18" width="4" height="8" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="14" y="10" width="4" height="16" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="22" y="14" width="4" height="12" rx="1" fill="white" fillOpacity="0.9" />
      {/* Trend line */}
      <polyline points="8,17 16,9 24,13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.7" />
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const w = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'

  return (
    <>
      {/* Push main content aside via a CSS variable override */}
      <style>{`:root { --sidebar-current: ${collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'}; }`}</style>
      <aside
        className="sidebar"
        style={{ width: w, overflow: collapsed ? 'visible' : 'hidden' }}
      >
        {/* Header — matches topbar height */}
        <div className="sidebar-logo" style={{ height: 'var(--topbar-height)', padding: '0 16px', gap: 10 }}>
          <LogoMark size={30} />
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div className="sidebar-logo-text">Portfolio</div>
              <div className="sidebar-logo-sub">Performance</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexShrink: 0,
            }}
          >
            {collapsed
              ? <PanelLeftOpen size={16} />
              : <PanelLeftClose size={16} />
            }
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="sidebar-section-label">{group.label}</div>
              )}
              {collapsed && <div style={{ height: 10 }} />}
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`sidebar-item ${isActive(href) ? 'active' : ''}`}
                  style={collapsed ? { justifyContent: 'center', padding: '10px 0', margin: '2px 8px' } : {}}
                >
                  <Icon size={18} style={{ flexShrink: 0 }} />
                  {!collapsed && label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Dynamic margin for main content */}
      <style>{`.main-content { margin-left: ${w}; }`}</style>
    </>
  )
}
