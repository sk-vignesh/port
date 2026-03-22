'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SecuritySearchInput from '@/components/SecuritySearchInput'
import { type IndianStock } from '@/lib/indian-stocks'

interface WatchlistItem {
  security_id: string
  sort_order: number
  securities: { id: string; name: string; ticker_symbol: string | null; currency_code: string } | null
}

export default function EditWatchlistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    const { data } = await supabase
      .from('watchlists')
      .select('name, watchlist_securities(security_id, sort_order, securities(id, name, ticker_symbol, currency_code))')
      .eq('id', params.id).single()
    if (data) {
      setName(data.name)
      setItems((data.watchlist_securities as unknown as WatchlistItem[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [params.id])

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('watchlists').update({ name: name.trim() }).eq('id', params.id)
    setSaving(false)
  }

  const addSecurity = async (stock: IndianStock) => {
    setAddMsg(null)
    // 1. Find or create the security
    let secId: string | null = null
    const { data: existing } = await supabase.from('securities').select('id').eq('ticker_symbol', stock.symbol).maybeSingle()
    if (existing) {
      secId = existing.id
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: created, error: cErr } = await supabase.from('securities').insert({
        user_id: user!.id, name: stock.name, ticker_symbol: stock.symbol,
        currency_code: 'INR', feed: 'YAHOO',
      }).select('id').single()
      if (cErr) { setAddMsg(`Error: ${cErr.message}`); return }
      secId = created.id
    }
    // 2. Check not already in watchlist
    if (items.some(i => i.security_id === secId)) {
      setAddMsg(`${stock.name} is already in this watchlist`)
      return
    }
    // 3. Insert watchlist_securities
    const sort_order = items.length
    const { error: wErr } = await supabase.from('watchlist_securities').insert({
      watchlist_id: params.id, security_id: secId, sort_order,
    })
    if (wErr) { setAddMsg(`Error: ${wErr.message}`); return }
    setAddMsg(`✓ Added ${stock.name}`)
    loadData()
  }

  const remove = async (secId: string) => {
    await supabase.from('watchlist_securities')
      .delete().eq('watchlist_id', params.id).eq('security_id', secId)
    setItems(i => i.filter(x => x.security_id !== secId))
  }

  const deleteWatchlist = async () => {
    if (!confirm('Delete this watchlist? This cannot be undone.')) return
    await supabase.from('watchlists').delete().eq('id', params.id)
    router.push('/watchlists')
  }

  if (loading) return <div className="page-header"><h1 className="page-title">Loading…</h1></div>

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="text-sm text-muted mb-2">
            <Link href="/watchlists" style={{ color: 'var(--color-accent-light)' }}>Watchlists</Link> / Edit
          </div>
          <h1 className="page-title">{name}</h1>
        </div>
        <button onClick={deleteWatchlist} className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
          Delete Watchlist
        </button>
      </div>

      {/* Watchlist name/note */}
      <form onSubmit={saveDetails} style={{ marginBottom: 24, maxWidth: 480 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Watchlist Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Name'}
            </button>
          </div>
        </div>
      </form>

      {/* Add securities */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">Add Security</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>search NSE stocks &amp; ETFs</span>
        </div>
        <div className="card-body">
          <SecuritySearchInput onSelect={addSecurity} placeholder="Search: TCS, Nifty BeES, HDFC Bank…" />
          {addMsg && (
            <div style={{ marginTop: 10, fontSize: '0.85rem', color: addMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {addMsg}
            </div>
          )}
        </div>
      </div>

      {/* Securities list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Securities in this Watchlist ({items.length})</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Security</th><th>Ticker</th><th>Currency</th><th style={{ width: 50 }}></th></tr></thead>
            <tbody>
              {!items.length ? (
                <tr><td colSpan={4}><div className="empty-state" style={{ padding: 28 }}>
                  <div className="empty-state-text">No securities yet — search above to add</div>
                </div></td></tr>
              ) : items
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(item => {
                    const sec = item.securities
                    if (!sec) return null
                    return (
                      <tr key={item.security_id}>
                        <td style={{ fontWeight: 600 }}>
                          <Link href={`/securities/${sec.id}`} style={{ color: 'var(--color-accent-light)' }}>{sec.name}</Link>
                        </td>
                        <td className="font-mono text-sm">{sec.ticker_symbol ?? '—'}</td>
                        <td><span className="badge badge-blue">{sec.currency_code}</span></td>
                        <td>
                          <button onClick={() => remove(item.security_id)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.85rem', opacity: 0.6 }}
                            title="Remove">✕</button>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4">
        <Link href="/watchlists" className="btn btn-secondary">← Back to Watchlists</Link>
      </div>
    </>
  )
}
