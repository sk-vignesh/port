'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatAmount, formatDate } from '@/lib/format'

interface Price { id: number; date: string; value: number }
interface Security { id: string; name: string; currency_code: string; ticker_symbol: string | null }

export default function SecurityPricesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [security, setSecurity] = useState<Security | null>(null)
  const [prices, setPrices] = useState<Price[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [addRow, setAddRow] = useState({ date: new Date().toISOString().slice(0, 10), value: '' })
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const loadData = async () => {
    const [{ data: sec }, { data: px }] = await Promise.all([
      supabase.from('securities').select('id, name, currency_code, ticker_symbol').eq('id', params.id).single(),
      supabase.from('security_prices').select('id, date, value').eq('security_id', params.id).order('date', { ascending: false }).limit(120),
    ])
    if (sec) setSecurity(sec)
    if (px) setPrices(px)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [params.id])

  const handleRefresh = async () => {
    if (!security?.ticker_symbol) { setRefreshMsg('No ticker symbol set — edit the security first.'); return }
    setRefreshing(true); setRefreshMsg(null)
    const res = await fetch(`/api/prices/refresh?security_id=${params.id}`)
    const j = await res.json()
    setRefreshMsg(j.updated > 0 ? `✓ Updated ${j.updated} price(s)` : j.errors?.[0] ?? 'No new prices (already up to date or rate-limited)')
    setRefreshing(false)
    loadData()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addRow.value || +addRow.value <= 0) { setAddError('Enter a valid price'); return }
    setAdding(true); setAddError(null)
    const { error } = await supabase.from('security_prices').upsert(
      { security_id: params.id, date: addRow.date, value: Math.round(+addRow.value * 100) },
      { onConflict: 'security_id,date' }
    )
    if (error) { setAddError(error.message); setAdding(false); return }
    setAddRow(r => ({ ...r, value: '' }))
    setAdding(false)
    loadData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this price entry?')) return
    await supabase.from('security_prices').delete().eq('id', id)
    setPrices(p => p.filter(x => x.id !== id))
  }

  if (loading) return <div className="page-header"><h1 className="page-title">Loading…</h1></div>
  if (!security) return <div className="page-header"><h1 className="page-title">Security not found</h1></div>

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/securities" style={{ color: 'var(--color-accent-light)' }}>Securities</Link>
            {' / '}
            <Link href={`/securities/${params.id}`} style={{ color: 'var(--color-accent-light)' }}>{security.name}</Link>
            {' / Prices'}
          </div>
          <h1 className="page-title">Price History</h1>
          <p className="page-subtitle">{security.name} · {security.currency_code}{security.ticker_symbol ? ` · ${security.ticker_symbol}` : ''}</p>
        </div>
        <div className="flex flex-gap-3">
          <button
            onClick={handleRefresh}
            className="btn btn-primary"
            disabled={refreshing}
          >
            {refreshing ? 'Fetching…' : '↻ Refresh from Yahoo'}
          </button>
          <Link href={`/securities/${params.id}`} className="btn btn-secondary">← Back</Link>
        </div>
      </div>

      {refreshMsg && (
        <div style={{
          padding: '10px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
          background: refreshMsg.startsWith('✓') ? 'var(--color-success-bg, rgba(34,197,94,0.1))' : 'var(--color-danger-bg)',
          color: refreshMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)',
          border: `1px solid ${refreshMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {refreshMsg}
        </div>
      )}

      {/* Add price row */}
      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Add / Update Price</span></div>
        <form onSubmit={handleAdd} className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={addRow.date}
                onChange={e => setAddRow(r => ({ ...r, date: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Close Price ({security.currency_code})</label>
              <input type="number" className="form-input" step="0.01" min="0" placeholder="182.52"
                value={addRow.value} onChange={e => setAddRow(r => ({ ...r, value: e.target.value }))} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? 'Saving…' : '+ Add Price'}</button>
          </div>
          {addError && <div style={{ marginTop: 10, color: 'var(--color-danger)', fontSize: '0.85rem' }}>{addError}</div>}
        </form>
      </div>

      {/* Price history table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Historical Prices ({prices.length})</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Last 120 entries</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="table-right">Close Price</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {!prices.length ? (
                <tr><td colSpan={3}>
                  <div className="empty-state" style={{ padding: 32 }}>
                    <div className="empty-state-text">No prices yet. Add manually or click ↻ Refresh from Yahoo.</div>
                  </div>
                </td></tr>
              ) : prices.map(p => (
                <tr key={p.id}>
                  <td className="text-sm text-muted">{formatDate(p.date)}</td>
                  <td className="table-right font-mono text-sm">{formatAmount(p.value, security.currency_code)}</td>
                  <td>
                    <button onClick={() => handleDelete(p.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6, padding: '2px 8px' }}
                      title="Delete">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
