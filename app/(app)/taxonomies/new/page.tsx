'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewTaxonomyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Get current max sort_order
    const { data: existing } = await supabase
      .from('taxonomies').select('sort_order').order('sort_order', { ascending: false }).limit(1)
    const nextSort = ((existing?.[0]?.sort_order as number | undefined) ?? 0) + 10

    const { data, error: err } = await supabase
      .from('taxonomies')
      .insert({ user_id: user.id, name: name.trim(), note: note.trim() || null, sort_order: nextSort })
      .select('id')
      .single()

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/taxonomies/${data.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div className="text-sm text-muted mb-2">
          <Link href="/taxonomies" style={{ color: 'var(--color-accent-light)' }}>Segments</Link> / New
        </div>
        <h1 className="page-title">New Segment</h1>
        <p className="page-subtitle">Create a taxonomy to classify your investments (e.g. Asset Class, Sector, Region)</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Segment Details</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="tax-name">Name *</label>
              <input
                id="tax-name" type="text" className="form-input"
                placeholder="e.g. Asset Class, Sector, Market Cap"
                value={name} onChange={e => setName(e.target.value)} required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tax-note">Description</label>
              <textarea
                id="tax-note" className="form-input" rows={3}
                placeholder="Optional — describe what this segment is used for…"
                value={note} onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', background: 'var(--color-danger-bg)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)', marginBottom: 16, fontSize: '0.875rem',
          }}>{error}</div>
        )}

        <div className="flex flex-gap-3">
          <button id="save-segment-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Segment'}
          </button>
          <Link href="/taxonomies" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  )
}
