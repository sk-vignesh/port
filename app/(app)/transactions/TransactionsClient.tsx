'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { TxRow } from '@/components/grids/TransactionsGrid'
import dynamic from 'next/dynamic'

const TransactionsGrid = dynamic(() => import('@/components/grids/TransactionsGrid'), { ssr: false })

type Tab = 'trades' | 'cash'

const TRADE_TYPE_LABELS: Record<string, string> = {
  BUY: 'Buy', SELL: 'Sell', DIVIDEND: 'Dividend', BONUS: 'Bonus Shares', SPLIT: 'Stock Split',
  INTEREST: 'Interest', COUPON: 'Coupon Payment', RENTAL_INCOME: 'Rental Income',
  DELIVERY_INBOUND: 'Buy (Delivery)', DELIVERY_OUTBOUND: 'Sell (Delivery)',
  TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
  MATURITY: 'Maturity Payment', CAPEX: 'Capital Expenditure',
}
const CASH_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit', WITHDRAWAL: 'Withdrawal', TRANSFER: 'Transfer',
  FEE: 'Fee / Charge', TAX: 'Tax', INTEREST: 'Interest', DIVIDEND: 'Dividend',
}

export default function TransactionsClient({
  rows,
  defaultTab = 'trades',
}: {
  rows: TxRow[]
  defaultTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(defaultTab)

  const tradeRows = useMemo(() => rows.filter(r => r.kind === 'portfolio').map(r => ({
    ...r,
    type_label: TRADE_TYPE_LABELS[r.type] ?? r.type_label,
  })), [rows])

  const cashRows = useMemo(() => rows.filter(r => r.kind === 'account').map(r => ({
    ...r,
    type_label: CASH_TYPE_LABELS[r.type] ?? r.type_label,
  })), [rows])

  const active = tab === 'trades' ? tradeRows : cashRows

  const TAB_BTN = (t: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
        fontWeight: 700, fontSize: '0.82rem', border: 'none',
        background: tab === t ? 'var(--color-accent)' : 'transparent',
        color: tab === t ? '#fff' : 'var(--color-text-muted)',
        transition: 'all 0.15s',
      }}
    >
      {label} <span style={{
        marginLeft: 6, padding: '2px 7px', borderRadius: 20, fontSize: '0.72rem',
        background: tab === t ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-input)',
        color: tab === t ? '#fff' : 'var(--color-text-muted)',
      }}>{count}</span>
    </button>
  )

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">All your trades and cash movements</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/portfolios" className="btn btn-primary btn-sm">↑↓ Record Trade</Link>
          <Link href="/accounts" className="btn btn-secondary btn-sm">+ Cash Movement</Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        width: 'fit-content', marginBottom: 16,
      }}>
        {TAB_BTN('trades', '📈 Trades', tradeRows.length)}
        {TAB_BTN('cash',   '💳 Cash',   cashRows.length)}
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        {active.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{tab === 'trades' ? '📊' : '💳'}</div>
            <div className="empty-state-title">
              {tab === 'trades' ? 'No trades yet' : 'No cash movements yet'}
            </div>
            <div className="empty-state-text">
              {tab === 'trades'
                ? 'Go to an Asset Class and record a Buy or Sell.'
                : 'Add a deposit or withdrawal from your Accounts page.'}
            </div>
          </div>
        ) : (
          <TransactionsGrid rows={active} />
        )}
      </div>
    </>
  )
}
