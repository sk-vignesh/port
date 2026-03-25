/**
 * PropertyCard — Server component
 *
 * Renders a single real estate property's investment summary:
 *   - Purchase cost, current market value, capital gain/loss
 *   - Price per sq ft, rental yield %, total cost (with stamp duty)
 *   - "Update Valuation" CTA for manual price entry
 *   - Amber state when no market price is set
 */
import { formatAmount } from '@/lib/format'
import Link from 'next/link'

interface Props {
  name:          string
  securityId:    string
  /** Total BUY amount in BIGINT×100 units */
  purchaseCost:  number
  /** Latest market valuation in BIGINT×100 units, or null if not set */
  currentValue:  number | null
  /** Stamp duty + registration fees in BIGINT×100 units */
  stampDuty:     number
  /** Built-up area in sq ft, or null if not recorded */
  area:          number | null
  /** Sum of INTEREST (rental income) transactions for current calendar year */
  annualRental:  number
  currency?:     string
}

function extractPropertyType(name: string): string {
  const match = name.match(/\(([^)]+)\)$/)
  return match?.[1] ?? 'Property'
}

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  'Residential Apartment': '#6366f1',
  'Independent House / Villa': '#8b5cf6',
  'Plot / Land': '#f59e0b',
  'Commercial Office': '#3b82f6',
  'Commercial Shop / Retail': '#ec4899',
  'Warehouse / Industrial': '#6b7280',
}

export default function PropertyCard({
  name, securityId,
  purchaseCost, currentValue, stampDuty,
  area, annualRental,
  currency = 'INR',
}: Props) {
  const totalCost    = purchaseCost + stampDuty
  const marketValue  = currentValue ?? purchaseCost   // fallback to cost when no price set
  const capitalGain  = marketValue - totalCost
  const gainPct      = totalCost > 0 ? (capitalGain / totalCost) * 100 : 0
  const isPositive   = capitalGain >= 0
  const hasPrice     = currentValue !== null

  const pricePerSqft = area && area > 0 && marketValue > 0
    ? Math.round(marketValue / area) / 100   // convert from ×100 scale → ₹/sqft
    : null

  const rentalYield = purchaseCost > 0 && annualRental > 0
    ? (annualRental / purchaseCost) * 100
    : null

  const propertyType = extractPropertyType(name)
  const displayName  = name.replace(/\s*\([^)]*\)$/, '')   // strip "(type)" suffix
  const typeColor    = PROPERTY_TYPE_COLORS[propertyType] ?? '#6b7280'

  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: 12,
      border: `1px solid ${hasPrice ? (isPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)') : 'rgba(245,158,11,0.3)'}`,
      background: hasPrice ? 'var(--color-bg-elevated)' : 'rgba(245,158,11,0.04)',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
            {displayName}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4,
              background: `${typeColor}18`, color: typeColor, fontWeight: 600,
            }}>
              {propertyType}
            </span>
            {area && (
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                · {area.toLocaleString('en-IN')} sq ft
              </span>
            )}
          </div>
        </div>

        {!hasPrice && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b',
            padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.1)',
          }}>
            ⚠ Price not set
          </span>
        )}
      </div>

      {/* Value summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Purchase Cost',   value: formatAmount(totalCost, currency),  color: 'var(--color-text-primary)' },
          { label: 'Market Value',    value: hasPrice ? formatAmount(marketValue, currency) : '—', color: hasPrice ? 'var(--color-accent-light)' : '#f59e0b' },
          { label: 'Capital Gain',    value: hasPrice ? `${isPositive ? '+' : ''}${formatAmount(capitalGain, currency)}` : '—', color: hasPrice ? (isPositive ? '#22c55e' : '#ef4444') : '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Gain badge */}
      {hasPrice && capitalGain !== 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem',
          background: isPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${isPositive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Overall return</span>
          <span style={{ fontWeight: 700, color: isPositive ? '#22c55e' : '#ef4444' }}>
            {isPositive ? '+' : ''}{gainPct.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Metrics grid */}
      {(pricePerSqft !== null || rentalYield !== null || stampDuty > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {pricePerSqft !== null && (
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Price / sq ft</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>₹{pricePerSqft.toLocaleString('en-IN')}</div>
            </div>
          )}
          {rentalYield !== null && (
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Rental Yield</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3b82f6' }}>{rentalYield.toFixed(2)}% p.a.</div>
            </div>
          )}
          {stampDuty > 0 && (
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Stamp Duty</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatAmount(stampDuty, currency)}</div>
            </div>
          )}
          {annualRental > 0 && (
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 2 }}>Annual Rental</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3b82f6' }}>{formatAmount(annualRental, currency)}</div>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/securities/${securityId}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.75rem', fontWeight: 600,
          color: hasPrice ? 'var(--color-accent-light)' : '#f59e0b',
          textDecoration: 'none',
        }}
      >
        {hasPrice ? '✎ Update Valuation' : '⊕ Set Current Market Value'}
        <span style={{ opacity: 0.6 }}>→</span>
      </Link>
    </div>
  )
}
