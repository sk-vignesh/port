export default function GainsLoading() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: 32, maxWidth: 160, marginBottom: 20, borderRadius: 6 }} />
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
        ))}
      </div>
      {/* Gains table */}
      <div className="skeleton" style={{ height: 380, borderRadius: 12 }} />
    </div>
  )
}
