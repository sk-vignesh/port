export default function PortfoliosLoading() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: 32, maxWidth: 200, marginBottom: 24, borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
