export default function HoldingsLoading() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: 32, maxWidth: 180, marginBottom: 20, borderRadius: 6 }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 48, borderRadius: 10, marginBottom: 4 }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 10, opacity: 0.6 }} />
        </div>
      ))}
    </div>
  )
}
