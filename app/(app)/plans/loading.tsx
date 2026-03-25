export default function PlansLoading() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: 32, maxWidth: 160, marginBottom: 20, borderRadius: 6 }} />
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  )
}
