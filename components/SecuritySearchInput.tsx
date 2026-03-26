'use client'

import { useState, useRef, useEffect } from 'react'

export interface SearchResult {
  symbol:    string
  name:      string
  sector?:   string
  exchange?: string   // e.g. "NSE", "BSE", "NMS"
  currency?: string   // e.g. "INR", "USD"
  type?:     string   // e.g. "EQUITY", "ETF", "MUTUALFUND"
}

interface Props {
  onSelect: (result: SearchResult) => void
  placeholder?: string
  lightTheme?: boolean
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''


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

function sectorDot(sector?: string) {
  const color = (sector && SECTOR_COLORS[sector]) ?? '#94a3b8'
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, flexShrink: 0, marginTop: 1,
    }} />
  )
}

export default function SecuritySearchInput({
  onSelect,
  placeholder = 'Search: Reliance, TCS, HDFC Bank, Nifty BeES…',
  lightTheme = false,
}: Props) {
  const inputStyles: React.CSSProperties = lightTheme ? {
    width: '100%', padding: '10px 14px', paddingLeft: 36,
    background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 12, color: '#111827', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box' as const,
  } : { paddingLeft: 36 }
  const dropdownStyles: React.CSSProperties = lightTheme ? {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 10000,
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    overflow: 'hidden', maxHeight: 320, overflowY: 'auto' as const,
  } : {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 10000,
    background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    overflow: 'hidden', maxHeight: 360, overflowY: 'auto' as const,
  }
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchResult[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(false)
  const [open,      setOpen]      = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const listRef      = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced live search
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setOpen(false); setError(false); return }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/price-search?q=${encodeURIComponent(q)}`,
          { headers: { apikey: ANON_KEY } }
        )
        if (res.ok) {
          const raw: Array<{
            symbol: string; name: string; exchange?: string;
            currency?: string; type?: string
          }> = await res.json()
          setResults(
            Array.isArray(raw)
              ? raw.slice(0, 9).map(d => ({
                  symbol:   d.symbol,
                  name:     d.name,
                  exchange: d.exchange,
                  currency: d.currency,
                  type:     d.type,
                }))
              : []
          )
          setOpen(true)
          setActiveIdx(0)
        } else {
          setError(true)
          setResults([])
        }
      } catch {
        setError(true)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleSelect = (result: SearchResult) => {
    setQuery('')
    setOpen(false)
    onSelect(result)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown')                           { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp')                        { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIdx])    { e.preventDefault(); handleSelect(results[activeIdx]) }
    else if (e.key === 'Escape')                         { setOpen(false); inputRef.current?.blur() }
  }

  const showDropdown = open && (loading || error || results.length > 0)

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
          className={lightTheme ? undefined : 'form-input'}
          style={inputStyles}
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value.trim().length >= 2) setOpen(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false); setResults([]); inputRef.current?.focus() }}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--color-text-muted)',
              cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={listRef}
          style={dropdownStyles}
        >
          {/* Header */}
          <div style={{
            padding: '6px 12px 4px', fontSize: '0.68rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: lightTheme ? '#6b7280' : 'var(--color-text-muted)',
            borderBottom: lightTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                Searching…
              </>
            ) : error ? (
              'Search unavailable'
            ) : (
              `${results.length} result${results.length !== 1 ? 's' : ''}`
            )}
          </div>

          {/* Results */}
          {!loading && !error && results.map((result, i) => (
            <button
              key={result.symbol}
              type="button"
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px',
                background: i === activeIdx
                  ? (lightTheme ? 'rgba(99,102,241,0.07)' : 'var(--color-bg-card-hover)')
                  : 'transparent',
                border: 'none',
                borderBottom: i < results.length - 1
                  ? (lightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--color-border)')
                  : 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.1s',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: '0.875rem',
                  color: lightTheme ? '#111827' : 'var(--color-text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {result.name}
                </div>
                <div style={{
                  fontSize: '0.72rem', color: lightTheme ? '#6b7280' : 'var(--color-text-muted)', marginTop: 2,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <code style={{ fontSize: '0.7rem', color: 'var(--color-accent-light)' }}>{result.symbol}</code>
                  {result.sector && (
                    <>
                      <span>·</span>
                      {sectorDot(result.sector)}
                      <span>{result.sector}</span>
                    </>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: '0.68rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                flexShrink: 0, fontWeight: 600,
              }}>{result.exchange ?? result.currency ?? 'NSE'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Spinner keyframe — scoped to this component */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
