'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PortfolioTxRow } from '@/components/grids/PortfolioTransactionsGrid'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const PortfolioTransactionsGrid = dynamic(
  () => import('@/components/grids/PortfolioTransactionsGrid'),
  { ssr: false }
)

export default function PortfolioDetailClient({
  portfolioId,
  rows,
}: {
  portfolioId: string
  rows: PortfolioTxRow[]
}) {
  const router = useRouter()
  const [selectedSecId,   setSelectedSecId]   = useState<string | null>(null)
  const [selectedSecName, setSelectedSecName] = useState<string | null>(null)

  const tradeUrl = (type: 'BUY' | 'SELL') =>
    selectedSecId
      ? `/portfolios/${portfolioId}/transactions/new?security_id=${selectedSecId}&type=${type}`
      : `/portfolios/${portfolioId}/transactions/new?type=${type}`

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="card-header" style={{ padding: '0 0 12px', flexWrap: 'wrap', gap: 8 }}>
        <span className="card-title">
          Transactions ({rows.length})
          {selectedSecName && (
            <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 10 }}>
              · {selectedSecName} selected
            </span>
          )}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Buy */}
          <button
            onClick={() => router.push(tradeUrl('BUY'))}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: 'none',
              background: selectedSecId ? '#22c55e' : 'var(--color-bg-input)',
              color: selectedSecId ? '#fff' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            title={selectedSecId ? `Buy ${selectedSecName}` : 'Select a row to pre-fill security'}
          >
            ↑ Buy
          </button>

          {/* Sell */}
          <button
            onClick={() => router.push(tradeUrl('SELL'))}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: 'none',
              background: selectedSecId ? '#ef4444' : 'var(--color-bg-input)',
              color: selectedSecId ? '#fff' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            title={selectedSecId ? `Sell ${selectedSecName}` : 'Select a row to pre-fill security'}
          >
            ↓ Sell
          </button>

          {/* New Trade (always available) */}
          <Link
            href={`/portfolios/${portfolioId}/transactions/new`}
            className="btn btn-primary btn-sm"
          >
            + New Trade
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          <div className="empty-state-text">No transactions yet — add a Buy to get started.</div>
        </div>
      ) : (
        <PortfolioTransactionsGrid
          rows={rows}
          portfolioId={portfolioId}
          onSelectionChange={(secId, secName) => {
            setSelectedSecId(secId)
            setSelectedSecName(secName)
          }}
        />
      )}
    </div>
  )
}
