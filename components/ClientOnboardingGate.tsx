'use client'

/**
 * ClientOnboardingGate — renders OnboardingModal when showOnboarding=true.
 * Server layout passes this flag after checking user_settings.onboarding_completed.
 * On completion, the modal unmounts and the regular app page is shown.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'

const OnboardingModal = dynamic(() => import('@/components/OnboardingModal'), { ssr: false })

export default function ClientOnboardingGate({ showOnboarding }: { showOnboarding: boolean }) {
  const [show, setShow] = useState(showOnboarding)
  if (!show) return null
  return <OnboardingModal onComplete={() => setShow(false)} />
}
