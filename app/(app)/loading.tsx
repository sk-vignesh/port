// Instant skeleton shown while any (app) page's server component loads data
export default function Loading() {
  const Bone = ({ w = '100%', h = 18, r = 6, mb = 0 }: { w?: string | number; h?: number; r?: number; mb?: number }) => (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--color-bg-elevated) 25%, var(--color-bg-input) 50%, var(--color-bg-elevated) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.4s ease infinite',
      marginBottom: mb,
    }} />
  )

  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <Bone w={220} h={28} r={8} mb={8} />
        <Bone w={160} h={15} r={6} />
      </div>

      {/* metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: '18px 20px' }}>
            <Bone w={80} h={12} r={4} mb={10} />
            <Bone w="60%" h={22} r={6} />
          </div>
        ))}
      </div>

      {/* main table card */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <Bone w={140} h={16} r={5} />
        </div>
        <div style={{ padding: '8px 0' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 20px', alignItems: 'center' }}>
              <Bone w="28%" h={13} r={4} />
              <Bone w="12%" h={13} r={4} />
              <Bone w="18%" h={13} r={4} />
              <Bone w="15%" h={13} r={4} />
              <Bone w="12%" h={13} r={4} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
