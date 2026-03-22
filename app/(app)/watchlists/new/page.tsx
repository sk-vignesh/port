'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewWatchlistPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data, error: err } = await supabase
      .from('watchlists')
      .insert({ name: name.trim(), user_id: user.id })
      .select('id').single()
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/watchlists/${data.id}/edit`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/watchlists" style={{ color: 'var(--color-accent-light)' }}>Watchlists</Link> / New
        </div>
        <h1 className="page-title">New Watchlist</h1>
        <p className="page-subtitle">Create a watchlist, then add securities to it</p>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" placeholder="e.g. Nifty 50 Watch, Tech Picks…" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
          </div>
        </div>
        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
        <div className="flex flex-gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create & Add Securities →'}</button>
          <Link href="/watchlists" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
