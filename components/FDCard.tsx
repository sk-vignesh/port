/**
 * FDCard — Server component
 *
 * Renders a single Fixed Deposit / debt instrument card showing:
 *   - Principal deposited
 *   - Current accrued value (compound interest)
 *   - Projected maturity value
 *   - Days to maturity with status color coding
 *   - Progress bar showing elapsed term
 *   - Coupon rate & frequency badge
 */
import {
  fdAccruedValue,
  fdMaturityValue,
  fdPeriodicInterest,
  fdElapsedFraction,
  daysToMaturity,
  type FDTransaction,
} from '@/lib/fd'
import { formatAmount } from '@/lib/format'

const FREQ_LABELS: Record<string, string> = {
  MONTHLY:    'Monthly',
  QUARTERLY:  'Quarterly',
  SEMI_ANNUAL: 'Half-Yearly',
  ANNUAL:     'Annual',
  AT_MATURITY: 'At Maturity',
}

interface Props {
  tx: FDTransaction & { security_name?: string | null }
  currency?: string
}

export default function FDCard({ tx, currency = 'INR' }: Props) {
  const principal = tx.face_value ?? 0
  const accrued   = fdAccruedValue(tx)
  const maturity  = fdMaturityValue(tx)
  const interest  = fdPeriodicInterest(tx)
  const fraction  = fdElapsedFraction(tx)
  const dtm       = tx.maturity_date ? daysToMaturity(tx.maturity_date) : null

  const isMatured = dtm !== null && dtm <= 0
  const isSoon    = dtm !== null && dtm > 0 && dtm <= 30

  const gain    = accrued - principal
  const gainPct = principal > 0 ? (gain / principal) * 100 : 0

  const borderColor = isMatured
    ? 'rgba(245,158,11,0.5)'
    : isSoon
    ? 'rgba(239,68,68,0.4)'
    : 'var(--color-border)'

  const bgColor = isMatured
    ? 'rgba(245,158,11,0.06)'
    : 'var(--color-bg-elevated)'

  const statusLabel = isMatured
    ? { text: '⚠ Matured', color: '#f59e0b' }
    : isSoon
    ? { text: `⚡ ${dtm}d left`, color: '#ef4444' }
    : dtm !== null
    ? { text: `${dtm}d to maturity`, color: 'var(--color-text-muted)' }
    : null

  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: 12,
      border: `1px solid ${borderColor}`,
      background: bgColor,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
            {tx.security_name ?? 'Fixed Deposit'}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tx.coupon_rate && (
              <span style={{
                fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4,
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontWeight: 700,
              }}>
                {tx.coupon_rate}% p.a.
              </span>
            )}
            {tx.interest_frequency && (
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                · {FREQ_LABELS[tx.interest_frequency] ?? tx.interest_frequency}
              </span>
            )}
          </div>
        </div>
        {statusLabel && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, color: statusLabel.color,
            padding: '3px 8px', borderRadius: 6,
            background: isMatured ? 'rgba(245,158,11,0.1)' : isSoon ? 'rgba(239,68,68,0.08)' : 'transparent',
          }}>
            {statusLabel.text}
          </span>
        )}
      </div>

      {/* Value grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Principal',       value: formatAmount(principal, currency), color: 'var(--color-text-primary)' },
          { label: 'Current Value',   value: formatAmount(accrued, currency),   color: '#22c55e' },
          { label: 'At Maturity',     value: formatAmount(maturity, currency),  color: 'var(--color-accent-light)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Gain badge */}
      {gain !== 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', borderRadius: 8,
          background: gain > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${gain > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          fontSize: '0.8rem',
        }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Accrued interest</span>
          <span style={{ fontWeight: 700, color: gain > 0 ? '#22c55e' : '#ef4444' }}>
            +{formatAmount(gain, currency)} ({gainPct.toFixed(2)}%)
          </span>
        </div>
      )}

      {/* Periodic interest info */}
      {interest > 0 && tx.interest_frequency && tx.interest_frequency !== 'AT_MATURITY' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {FREQ_LABELS[tx.interest_frequency]} payout: <strong style={{ color: 'var(--color-text-primary)' }}>{formatAmount(interest, currency)}</strong>
        </div>
      )}

      {/* Progress bar */}
      {tx.maturity_date && (
        <div>
          <div style={{
            height: 6, borderRadius: 999,
            background: 'var(--color-border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(fraction * 100).toFixed(1)}%`,
              borderRadius: 999,
              background: isMatured
                ? '#f59e0b'
                : isSoon
                ? '#ef4444'
                : 'linear-gradient(90deg, #6366f1, #22c55e)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            <span>{tx.date}</span>
            <span>{(fraction * 100).toFixed(0)}% elapsed</span>
            <span>{tx.maturity_date}</span>
          </div>
        </div>
      )}
    </div>
  )
}
