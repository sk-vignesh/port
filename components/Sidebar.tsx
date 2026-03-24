'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock,
  BarChart3, Star, Layers, PanelLeftClose, PanelLeftOpen,
  ChevronDown, ChevronRight, TrendingUp, Settings, Activity, Upload, HelpCircle,
} from 'lucide-react'

interface Portfolio { id: string; name: string }

// ── Colorful icon wrappers ──────────────────────────────────────────────────
const IconWrap = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8,
    background: `${color}22`, flexShrink: 0,
    color,
  }}>
    {children}
  </span>
)

const navItems = [
  {
    label: 'Overview',
    items: [
      { href: '/',          label: 'Dashboard',    icon: <LayoutDashboard size={15} />,    color: '#3b82f6' },
      { href: '/accounts',  label: 'Accounts',     icon: <Wallet size={15} />,             color: '#14b8a6' },
      { href: '/holdings',  label: 'All Holdings', icon: <Layers size={15} />,             color: '#8b5cf6' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { href: '/transactions', label: 'Transactions', icon: <ArrowLeftRight size={15} />, color: '#a855f7' },
      { href: '/plans',        label: 'Plans',         icon: <CalendarClock size={15} />,  color: '#f59e0b' },
      { href: '/import',       label: 'Import',        icon: <Upload size={15} />,         color: '#22c55e' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/gains',      label: 'Gains & P&L',  icon: <TrendingUp size={15} />,  color: '#f59e0b' },
      { href: '/market',     label: 'Market',        icon: <Activity size={15} />,    color: '#10b981' },
      { href: '/reports',    label: 'Reports',       icon: <BarChart3 size={15} />,   color: '#f97316' },
      { href: '/watchlists', label: 'Watchlists',    icon: <Star size={15} />,        color: '#ec4899' },
      { href: '/taxonomies', label: 'Segments',      icon: <Layers size={15} />,      color: '#6366f1' },
      { href: '/help',       label: 'Help Centre',   icon: <HelpCircle size={15} />,  color: '#64748b' },
    ],
  },
]

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="400" height="400" rx="72" fill="#244c89"/>
      {/* 4 ascending bars — Apna Stocks logo */}
      <rect x="42"  y="272" width="65" height="90"  rx="10" fill="white"/>
      <rect x="125" y="212" width="65" height="150" rx="10" fill="white"/>
      <rect x="208" y="155" width="65" height="207" rx="10" fill="white"/>
      <rect x="291" y="92"  width="65" height="270" rx="10" fill="white"/>
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed]     = useState(false)
  const [portfolios, setPortfolios]   = useState<Portfolio[]>([])
  const [portOpen, setPortOpen]       = useState(true)

  // Fetch portfolios client-side for sidebar list
  useEffect(() => {
    const supabase = createClient()
    supabase.from('portfolios').select('id, name').eq('is_retired', false).order('name')
      .then(({ data }) => { if (data) setPortfolios(data) })
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const NavLink = ({ href, label, icon, color }: { href: string; label: string; icon: React.ReactNode; color: string }) => {
    const active = isActive(href)
    return (
      <Link href={href} style={{
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
        padding: collapsed ? '7px 0' : '7px 10px', borderRadius: 8,
        background: active ? `${color}18` : 'transparent',
        border: active ? `1px solid ${color}30` : '1px solid transparent',
        color: active ? color : 'var(--color-text-secondary)',
        fontWeight: active ? 600 : 500,
        fontSize: '0.82rem', textDecoration: 'none',
        transition: 'background 0.1s, color 0.1s, border-color 0.1s',
        cursor: 'pointer',
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%',
      }}
      title={collapsed ? label : undefined}>
        <IconWrap color={color}>{icon}</IconWrap>
        {!collapsed && <span style={{ lineHeight: 1 }}>{label}</span>}
      </Link>
    )
  }

  return (
    <aside style={{
      width: collapsed ? 64 : 220,
      minHeight: '100vh',
      background: 'var(--color-bg-elevated)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden', flexShrink: 0,
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 56,
        padding: collapsed ? '0' : '0 16px',
        borderBottom: '1px solid var(--color-border)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0,
      }}>
        <LogoMark size={30} />
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>Apna Stocks</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Apna Portfolio</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '12px 8px' : '12px 10px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Portfolios — dynamic section */}
        <div>
          {!collapsed && (
            <div
              onClick={() => setPortOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '2px 6px 6px', cursor: 'pointer',
                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--color-text-muted)',
              }}>
              <span>Asset Classes</span>
              {portOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          )}
          {portOpen && portfolios.map(p => {
            const active = pathname.startsWith(`/portfolios/${p.id}`)
            return (
              <Link key={p.id} href={`/portfolios/${p.id}`} style={{
                display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
                padding: collapsed ? '8px 0' : '7px 10px', borderRadius: 8,
                background: active ? '#22c55e18' : 'transparent',
                border: active ? '1px solid #22c55e30' : '1px solid transparent',
                color: active ? '#22c55e' : 'var(--color-text-secondary)',
                fontWeight: active ? 600 : 500,
                fontSize: '0.82rem', textDecoration: 'none',
                transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              title={collapsed ? p.name : undefined}>
                <IconWrap color="#22c55e"><TrendingUp size={15} /></IconWrap>
                {!collapsed && (
                  <span style={{ lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                )}
              </Link>
            )
          })}
          {portOpen && portfolios.length === 0 && !collapsed && (
            <Link href="/portfolios" style={{
              display: 'block', padding: '6px 10px', fontSize: '0.78rem',
              color: 'var(--color-text-muted)', textDecoration: 'none',
              borderRadius: 6, border: '1px dashed var(--color-border)',
              textAlign: 'center', marginTop: 4,
            }}>+ Add Asset Class</Link>
          )}
        </div>

        {/* Static sections */}
        {navItems.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <div style={{
                padding: '2px 6px 6px', fontSize: '0.65rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)',
              }}>{group.label}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map(item => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Settings + collapse */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 10px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NavLink href="/settings" label="Settings" icon={<Settings size={15} />} color="#64748b" />
        <button onClick={() => setCollapsed(v => !v)} style={{
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end',
          gap: 6, padding: '8px 6px', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--color-text-muted)', width: '100%',
          borderRadius: 6, transition: 'color 0.15s',
        }} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <PanelLeftOpen size={16} /> : <><span style={{ fontSize: '0.72rem' }}>Collapse</span><PanelLeftClose size={16} /></>}
        </button>
      </div>
    </aside>
  )
}
