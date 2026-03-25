'use client'

import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children?: React.ReactNode
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState<'top' | 'bottom'>('top')
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!visible || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos(rect.top < 80 ? 'bottom' : 'top')
  }, [visible])

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 15, height: 15, borderRadius: '50%',
          background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)', fontSize: '0.65rem', fontWeight: 700,
          cursor: 'help', flexShrink: 0, lineHeight: 1,
        }}>?</span>
      )}
      {visible && (
        <span style={{
          position: 'absolute',
          [pos === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8, padding: '7px 11px',
          fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 400,
          whiteSpace: 'pre-wrap', maxWidth: 260, width: 'max-content',
          zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          {content}
          {/* Arrow */}
          <span style={{
            position: 'absolute',
            [pos === 'top' ? 'top' : 'bottom']: '100%',
            left: '50%', transform: 'translateX(-50%)',
            borderWidth: 5, borderStyle: 'solid',
            borderColor: pos === 'top'
              ? 'transparent transparent var(--color-border) transparent'
              : 'var(--color-border) transparent transparent transparent',
          }} />
        </span>
      )}
    </span>
  )
}
