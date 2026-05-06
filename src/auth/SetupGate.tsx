// src/auth/SetupGate.tsx
import React from 'react'
import { STORAGE_KEYS } from '@/lib/auth'
import { SetupWizard } from './setup/SetupWizard'

export function SetupGate({ children }: { children: React.ReactNode }) {
  const isComplete = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true'
  return isComplete ? <>{children}</> : <SetupWizard />
}
