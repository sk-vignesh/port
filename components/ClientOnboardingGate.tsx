'use client'

/**
 * ClientOnboardingGate — renders OnboardingModal when showOnboarding=true
 * OR when the URL has ?wizard=1 (manual relaunch from profile menu).
 */

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const OnboardingModal = dynamic(() => import('@/components/OnboardingModal'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0a0d1a' }} />
  ),
})

export default function ClientOnboardingGate({ showOnboarding }: { showOnboarding: boolean }) {
  const params      = useSearchParams()
  const forceWizard = params.get('wizard') === '1'
  const [show, setShow] = useState(showOnboarding || forceWizard)
  if (!show) return null
  return <OnboardingModal onComplete={() => setShow(false)} />
}
