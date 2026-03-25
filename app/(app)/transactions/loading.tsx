export default function TransactionsLoading() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: 32, maxWidth: 200, marginBottom: 20, borderRadius: 6 }} />
      <div className="skeleton" style={{ height: 40, maxWidth: 300, marginBottom: 20, borderRadius: 8 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 12 }} />
    </div>
  )
}
