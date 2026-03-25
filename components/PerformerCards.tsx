'use client'

/**
 * PerformerCards
 * 
 * Lazy-loads from the gains Edge Function on mount and displays
 * Best Performer (🏆) and Worst Performer (⚠) callout cards.
 * Renders nothing until data arrives — no blocking, no skeleton.
 */
import { useState, useEffect } from 'react'
import { formatAmount } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

interface GainsRow {
  name:              string
  ticker:            string | null
  currency:          string
  currentValue:      number | null
  unrealizedGain:    number | null
  unrealizedGainPct: number | null
  xirr:              number | null
}

function Card({
  row, label, positive,
}: {
  row: GainsRow; label: string; positive: boolean
}) {
  const color   = positive ? '#22c55e' : '#ef4444'
  const gainPct = (row.unrealizedGainPct ?? 0) * 100

  return (
    <div style={{
      padding: '16px 20px', borderRadius: 12, flex: 1, minWidth: 200,
      border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
      background: positive ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
    }}>
      {/* Label */}
      <div style={{
        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.09em', color, marginBottom: 8,
      }}>
        {label}
      </div>

      {/* Name + ticker */}
      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>
        {row.name}
      </div>
      {row.ticker && (
        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
          {row.ticker}
        </div>
      )}

      {/* Main gain % */}
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1 }}>
        {positive ? '+' : ''}{gainPct.toFixed(1)}%
      </div>

      {/* Gain amount */}
      {row.unrealizedGain != null && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
          {positive ? '+' : ''}{formatAmount(row.unrealizedGain, row.currency)}
        </div>
      )}

      {/* XIRR badge */}
      {row.xirr != null && (
        <div style={{
          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4,
          background: `${color}12`, color,
        }}>
          XIRR {(row.xirr * 100).toFixed(2)}% p.a.
        </div>
      )}
    </div>
  )
}

export default function PerformerCards() {
  const [best,    setBest]    = useState<GainsRow | null>(null)
  const [worst,   setWorst]   = useState<GainsRow | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function fetchGains() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch(`${SUPABASE_URL}/functions/v1/gains`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: ANON_KEY,
          },
        })
        if (!res.ok) return

        const { holdings } = await res.json() as { holdings: GainsRow[] }
        if (!Array.isArray(holdings) || holdings.length === 0) return

        // Only consider holdings with live price data
        const priced = holdings.filter(
          h => h.currentValue != null && h.unrealizedGainPct != null
        )
        if (priced.length < 2) return

        const sorted = [...priced].sort(
          (a, b) => (b.unrealizedGainPct ?? 0) - (a.unrealizedGainPct ?? 0)
        )

        setBest(sorted[0])
        setWorst(sorted[sorted.length - 1])
        setVisible(true)
      } catch { /* silent — cards just won't show */ }
    }
    fetchGains()
  }, [])

  if (!visible || (!best && !worst)) return null

  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
      {best  && <Card row={best}  label="🏆 Best Performer"  positive />}
      {worst && <Card row={worst} label="⚠ Worst Performer" positive={false} />}
    </div>
  )
}
