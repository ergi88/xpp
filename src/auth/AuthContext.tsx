// src/auth/AuthContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { STORAGE_KEYS } from '@/lib/auth'

interface AuthContextValue {
  isLocked: boolean
  lock: () => void
  unlock: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true)

  const lock = useCallback(() => setIsLocked(true), [])
  const unlock = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(Date.now()))
    setIsLocked(false)
  }, [])

  useEffect(() => {
    const timeout = Number(localStorage.getItem(STORAGE_KEYS.LOCK_TIMEOUT) ?? '5')
    const lastActivity = Number(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) ?? '0')
    const elapsed = (Date.now() - lastActivity) / 60000

    if (lastActivity > 0 && elapsed < timeout) {
      setIsLocked(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
    </AuthContext.Provider>
  )
}
