// Instant skeleton shown while any (app) page server component loads
export default function Loading() {
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* Page header skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28, animation: 'fade-in 0.3s ease' }}>
        <div style={{ height: 26, width: 200, borderRadius: 6, background: 'var(--color-bg-elevated)' }} />
        <div style={{ height: 14, width: 130, borderRadius: 5, background: 'var(--color-bg-elevated)' }} />
      </div>

      {/* Spinner centred in the content area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 20, animation: 'fade-in 0.3s ease' }}>
        {/* Outer ring */}
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '3px solid var(--color-border)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: 'var(--color-accent-light)',
            borderRightColor: 'var(--color-accent-light)',
            animation: 'spin 0.9s linear infinite',
          }} />
          {/* Inner chart icon */}
          <div style={{
            position: 'absolute', inset: 10,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-accent-glow), transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem',
          }}>
            📈
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
          Loading your portfolio…
        </div>
      </div>
    </>
  )
}
