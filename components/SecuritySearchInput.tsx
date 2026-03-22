'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  currency: string
  type: string
}

interface Props {
  onSelect: (result: SearchResult) => void
  placeholder?: string
  initialValue?: string
}

const TYPE_LABELS: Record<string, string> = {
  EQUITY: 'Stock', ETF: 'ETF', MUTUALFUND: 'Fund', CRYPTOCURRENCY: 'Crypto',
}

export default function SecuritySearchInput({ onSelect, placeholder = 'Search stocks, ETFs… (e.g. Apple, RELIANCE)', initialValue = '' }: Props) {
  const [query, setQuery] = useState(initialValue)
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [selected, setSelected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    const res = await fetch(`/api/prices/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setResults(data)
    setOpen(data.length > 0)
    setLoading(false)
    setActiveIdx(-1)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setSelected(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 280)
  }

  const handleSelect = (r: SearchResult) => {
    setQuery(`${r.name} (${r.symbol})`)
    setSelected(true)
    setOpen(false)
    setResults([])
    onSelect(r)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(results[activeIdx]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const EXCHANGE_FLAG: Record<string, string> = {
    NSE: '🇮🇳', BSE: '🇮🇳', BOM: '🇮🇳',
    NMS: '🇺🇸', NGM: '🇺🇸', NYQ: '🇺🇸', PCX: '🇺🇸',
    LSE: '🇬🇧', LON: '🇬🇧',
    ETR: '🇩🇪', FRA: '🇩🇪',
    TYO: '🇯🇵', TSX: '🇨🇦', ASX: '🇦🇺', VTX: '🇨🇭',
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && !selected && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            searching…
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => handleSelect(r)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px',
                background: i === activeIdx ? 'var(--color-bg-card-hover)' : 'transparent',
                border: 'none',
                borderBottom: i < results.length - 1 ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{EXCHANGE_FLAG[r.exchange] ?? '🌐'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {r.symbol} · {r.exchange} · {r.currency}
                </div>
              </div>
              <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                {TYPE_LABELS[r.type] ?? r.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
