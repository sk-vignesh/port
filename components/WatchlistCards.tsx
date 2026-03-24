'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WatchlistSecurityItem {
  id: string            // security_id
  name: string
  note?: string | null
  alert?: WatchAlert | null
}

export interface WatchAlert {
  id?: string
  alert_type: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'CHANGE_PCT_UP' | 'CHANGE_PCT_DOWN'
  threshold: number
  note?: string | null
  is_active: boolean
  triggered_at?: string | null
}

// ── Alert badge ───────────────────────────────────────────────────────────────
const ALERT_ICONS: Record<string, string> = {
  PRICE_ABOVE:    '📈',
  PRICE_BELOW:    '📉',
  CHANGE_PCT_UP:  '🚀',
  CHANGE_PCT_DOWN:'⚠️',
}
const ALERT_LABELS: Record<string, string> = {
  PRICE_ABOVE:    'Price rises above',
  PRICE_BELOW:    'Price falls below',
  CHANGE_PCT_UP:  '% change exceeds',
  CHANGE_PCT_DOWN:'% drop exceeds',
}

function AlertBadge({ alert }: { alert: WatchAlert }) {
  const isPct = alert.alert_type.includes('PCT')
  const threshold = isPct ? `${alert.threshold}%` : `₹${alert.threshold.toLocaleString('en-IN')}`
  const triggered = !!alert.triggered_at
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
      border: `1px solid ${triggered ? '#ef444440' : '#f59e0b40'}`,
      background: triggered ? '#ef44440d' : '#f59e0b0d',
      color: triggered ? '#ef4444' : '#f59e0b',
    }}>
      {ALERT_ICONS[alert.alert_type]} {ALERT_LABELS[alert.alert_type]} {threshold}
      {triggered && <span style={{ opacity: 0.7 }}>· triggered</span>}
    </span>
  )
}

// ── Alert form (inline, collapsible) ─────────────────────────────────────────
function AlertForm({
  securityId, watchlistId, existing, onSaved,
}: {
  securityId: string; watchlistId: string; existing?: WatchAlert | null;
  onSaved: (alert: WatchAlert) => void;
}) {
  const [type, setType] = useState<WatchAlert['alert_type']>(existing?.alert_type ?? 'PRICE_ABOVE')
  const [threshold, setThreshold] = useState(existing ? String(existing.threshold) : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [pending, start] = useTransition()

  const isPct = type.includes('PCT')

  const save = () => {
    const val = parseFloat(threshold)
    if (isNaN(val)) return
    start(async () => {
      const body = { security_id: securityId, watchlist_id: watchlistId, alert_type: type, threshold: val, note: note || null, is_active: true }
      const url = existing?.id ? `/api/watch-alerts/${existing.id}` : '/api/watch-alerts'
      const method = existing?.id ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        const saved = await r.json()
        onSaved(saved)
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--color-bg-elevated)', borderRadius: 8, border: '1px solid var(--color-border)', marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={type} onChange={e => setType(e.target.value as WatchAlert['alert_type'])}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.82rem', flex: 1, minWidth: 160 }}>
          <option value="PRICE_ABOVE">📈 Price rises above</option>
          <option value="PRICE_BELOW">📉 Price falls below</option>
          <option value="CHANGE_PCT_UP">🚀 % gain exceeds</option>
          <option value="CHANGE_PCT_DOWN">⚠️ % drop exceeds</option>
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 100 }}>
          {!isPct && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>₹</span>}
          <input
            type="number" min={0} step={isPct ? 0.1 : 0.01}
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            placeholder={isPct ? 'e.g. 5' : 'e.g. 2400'}
            style={{ padding: isPct ? '5px 8px' : '5px 8px 5px 22px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.82rem', width: '100%' }}
          />
          {isPct && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>%</span>}
        </div>
        <input
          type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)"
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.82rem', flex: 2, minWidth: 120 }}
        />
        <button onClick={save} disabled={pending || !threshold}
          style={{ padding: '5px 14px', borderRadius: 6, background: 'var(--color-accent)', border: 'none', color: 'white', fontWeight: 600, fontSize: '0.82rem', cursor: pending ? 'wait' : 'pointer', opacity: !threshold ? 0.5 : 1 }}>
          {pending ? '…' : existing?.id ? 'Update' : 'Set Alert'}
        </button>
      </div>
    </div>
  )
}

// ── Single security card ──────────────────────────────────────────────────────
function SecurityCard({ item, watchlistId }: { item: WatchlistSecurityItem; watchlistId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [alert, setAlert] = useState<WatchAlert | null | undefined>(item.alert)

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'border-color 0.15s',
    }}>
      {/* Row 1: name + alert toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Link href={`/securities/${item.id}`}
          style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-accent-light)', textDecoration: 'none' }}>
          {item.name}
        </Link>
        <button onClick={() => setShowForm(v => !v)}
          title={alert ? 'Edit alert' : 'Set alert'}
          style={{
            padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
            border: `1px solid ${alert?.is_active ? '#f59e0b60' : 'var(--color-border)'}`,
            background: alert?.is_active ? '#f59e0b10' : 'transparent',
            color: alert?.is_active ? '#f59e0b' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}>
          🔔 {alert?.is_active ? 'Alert set' : '+ Alert'}
        </button>
      </div>

      {/* Row 2: existing alert badge */}
      {alert?.is_active && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <AlertBadge alert={alert} />
          {alert.note && (
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
              {alert.note}
            </span>
          )}
        </div>
      )}

      {/* Row 3: inline alert form */}
      {showForm && (
        <AlertForm
          securityId={item.id}
          watchlistId={watchlistId}
          existing={alert}
          onSaved={saved => { setAlert(saved); setShowForm(false) }}
        />
      )}
    </div>
  )
}

// ── Main watchlist display ────────────────────────────────────────────────────
export default function WatchlistCards({
  items, watchlistId,
}: { items: WatchlistSecurityItem[]; watchlistId: string }) {
  if (items.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div className="empty-state-text">Watchlist is empty — add securities via the edit button above</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: '4px 0' }}>
      {items.map(item => (
        <SecurityCard key={item.id} item={item} watchlistId={watchlistId} />
      ))}
    </div>
  )
}
