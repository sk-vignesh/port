import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

export default async function TaxonomiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: taxonomies } = await supabase
    .from('taxonomies')
    .select('*, classifications(id, name, color, parent_id, sort_order, classification_assignments(id))')
    .order('sort_order')

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Segments</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>Classify your holdings by Sector, Market Cap, Asset Type and more</p>
          <p className="page-subtitle">Segments for classifying your investments</p>
        </div>
        <Link href="/taxonomies/new" className="btn btn-primary">+ New Segment</Link>
      </div>

      {!taxonomies?.length ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🗂️</div>
            <div className="empty-state-title">No segments yet</div>
            <div className="empty-state-text">
              Create segments to classify your investments by asset class, region, sector, or any other dimension.
            </div>
            <Link href="/taxonomies/new" className="btn btn-primary mt-4">Create Taxonomy</Link>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {taxonomies.map(taxonomy => {
            const classifications = (taxonomy.classifications as {
              id: string; name: string; color: string; parent_id: string | null; sort_order: number;
              classification_assignments: { id: string }[]
            }[] ?? []).sort((a, b) => a.sort_order - b.sort_order)
            const rootNodes = classifications.filter(c => !c.parent_id)
            const totalAssignments = classifications.reduce((s, c) => s + c.classification_assignments.length, 0)

            return (
              <div key={taxonomy.id} className="card" style={{ padding: 24 }}>
                <div className="flex-between mb-4">
                  <h3 style={{ fontWeight: 700 }}>{taxonomy.name}</h3>
                  <div className="flex flex-gap-2">
                    <span className="badge badge-gray">{classifications.length} nodes</span>
                    <span className="badge badge-blue">{totalAssignments} assigned</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rootNodes.slice(0, 8).map(node => {
                    const children = classifications.filter(c => c.parent_id === node.id)
                    return (
                      <div key={node.id}>
                        <div className="flex flex-gap-2 items-center">
                          <div style={{
                            width: 10, height: 10, borderRadius: 3,
                            background: node.color, flexShrink: 0
                          }} />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{node.name}</span>
                          {node.classification_assignments.length > 0 && (
                            <span className="badge badge-gray" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                              {node.classification_assignments.length}
                            </span>
                          )}
                        </div>
                        {children.length > 0 && (
                          <div style={{ marginLeft: 22, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {children.map(ch => (
                              <div key={ch.id} className="flex flex-gap-2 items-center">
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: ch.color, flexShrink: 0 }} />
                                <span className="text-sm text-muted">{ch.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {rootNodes.length > 8 && (
                    <div className="text-xs text-muted">+{rootNodes.length - 8} more…</div>
                  )}
                </div>
                <div className="flex flex-gap-2 mt-4">
                  <Link href={`/taxonomies/${taxonomy.id}`} className="btn btn-secondary btn-sm">Manage</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
