// src/auth/useActivityTracker.ts
import { useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { STORAGE_KEYS } from '@/lib/auth'

export function useActivityTracker() {
  const { lock, isLocked } = useAuth()
  const lastWriteRef = useRef(0)

  useEffect(() => {
    if (isLocked) return

    const updateActivity = () => {
      const now = Date.now()
      if (now - lastWriteRef.current < 1000) return
      lastWriteRef.current = now
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(now))
    }

    const checkTimeout = () => {
      const timeout = Number(localStorage.getItem(STORAGE_KEYS.LOCK_TIMEOUT) ?? '5')
      const lastActivity = Number(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) ?? '0')
      const elapsedMinutes = (Date.now() - lastActivity) / 60000
      if (elapsedMinutes >= timeout) lock()
    }

    const events = ['mousemove', 'keydown', 'touchstart', 'click'] as const
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }))

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkTimeout()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const interval = setInterval(checkTimeout, 30_000)

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(interval)
    }
  }, [isLocked, lock])
}
