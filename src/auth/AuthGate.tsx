// src/auth/AuthGate.tsx
import React from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { LockScreen } from './lock-screen/LockScreen'
import { useActivityTracker } from './useActivityTracker'

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAuth()
  useActivityTracker()
  return isLocked ? <LockScreen /> : <>{children}</>
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGateInner>{children}</AuthGateInner>
    </AuthProvider>
  )
}
