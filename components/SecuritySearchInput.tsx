'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import NSE_STOCKS, { type IndianStock } from '@/lib/indian-stocks'

interface Props {
  onSelect: (stock: IndianStock) => void
  placeholder?: string
}

/** Simple multi-word fuzzy match — every word in query must appear in name or symbol */
function matches(stock: IndianStock, query: string): boolean {
  const haystack = `${stock.name} ${stock.symbol} ${stock.sector}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).every(word => haystack.includes(word))
}

const SECTOR_COLORS: Record<string, string> = {
  'IT':            '#3b82f6',
  'Banking':       '#6366f1',
  'Finance':       '#8b5cf6',
  'Fintech':       '#a78bfa',
  'Pharma':        '#22c55e',
  'Healthcare':    '#16a34a',
  'Energy':        '#f59e0b',
  'Utilities':     '#d97706',
  'FMCG':          '#ec4899',
  'Auto':          '#f97316',
  'Industrials':   '#64748b',
  'Materials':     '#78716c',
  'Consumer':      '#14b8a6',
  'Consumer Tech': '#06b6d4',
  'Retail':        '#0ea5e9',
  'Insurance':     '#84cc16',
  'Defence':       '#ef4444',
  'Telecom':       '#a855f7',
  'Electronics':   '#06b6d4',
}

function sectorDot(sector: string) {
  const color = SECTOR_COLORS[sector] ?? '#94a3b8'
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 1 }} />
}

export default function SecuritySearchInput({ onSelect, placeholder = 'Search: Reliance, TCS, HDFC Bank, Nifty BeES…' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Instant local search — no debounce needed
  const results = useMemo<IndianStock[]>(() => {
    const q = query.trim()
    if (q.length < 1) return []
    return NSE_STOCKS.filter(s => matches(s, q)).slice(0, 9)
  }, [query])

  useEffect(() => {
    setOpen(results.length > 0)
    setActiveIdx(0)
  }, [results])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleSelect = (stock: IndianStock) => {
    setQuery('')
    setOpen(false)
    onSelect(stock)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIdx]) { e.preventDefault(); handleSelect(results[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: '0.9rem', pointerEvents: 'none', color: 'var(--color-text-muted)',
        }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          style={{ paddingLeft: 36 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus() }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 400,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '6px 12px 4px', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
            NSE · INR · {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          {results.map((stock, i) => (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => handleSelect(stock)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px',
                background: i === activeIdx ? 'var(--color-bg-card-hover)' : 'transparent',
                border: 'none',
                borderBottom: i < results.length - 1 ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.1s',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stock.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <code style={{ fontSize: '0.7rem', color: 'var(--color-accent-light)' }}>{stock.symbol}</code>
                  <span>·</span>
                  {sectorDot(stock.sector)}
                  <span>{stock.sector}</span>
                </div>
              </div>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', flexShrink: 0, fontWeight: 600 }}>
                INR
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
