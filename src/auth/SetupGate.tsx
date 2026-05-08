import React, { useState } from 'react'
import { STORAGE_KEYS } from '@/lib/auth'
import { SetupWizard } from './setup/SetupWizard'

export function SetupGate({ children }: { children: React.ReactNode }) {
  const [isComplete, setIsComplete] = useState(
    localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true'
  )
  return isComplete
    ? <>{children}</>
    : <SetupWizard onComplete={() => setIsComplete(true)} />
}
