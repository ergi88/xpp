// src/hooks/use-sync-status.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  syncAll,
  flushMutationQueue,
  getLastSyncTime,
  getSyncErrors,
  clearSyncErrors,
  type SyncError,
} from '@/lib/sync'
import { getQueue } from '@/lib/mutation-queue'

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncedAt] = useState<Date | null>(getLastSyncTime)
  const [queuedCount, setQueuedCount] = useState(0)
  const [errors, setErrors] = useState<SyncError[]>(getSyncErrors)

  const syncingRef = useRef(false)
  const isOnlineRef = useRef(navigator.onLine)

  useEffect(() => {
    getQueue().then((q) => setQueuedCount(q.length))
  }, [])

  useEffect(() => {
    const onOnline = async () => {
      isOnlineRef.current = true
      setIsOnline(true)
      syncingRef.current = true
      setIsSyncing(true)
      try {
        await flushMutationQueue()
        const remaining = await getQueue()
        setQueuedCount(remaining.length)
        setLastSyncedAt(getLastSyncTime())
        setErrors(getSyncErrors())
      } catch {
        setErrors(getSyncErrors())
      } finally {
        syncingRef.current = false
        setIsSyncing(false)
      }
    }
    const onOffline = () => {
      isOnlineRef.current = false
      setIsOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current || !isOnlineRef.current) return
    syncingRef.current = true
    setIsSyncing(true)
    try {
      await syncAll()
      setLastSyncedAt(getLastSyncTime())
      setErrors(getSyncErrors())
      const remaining = await getQueue()
      setQueuedCount(remaining.length)
    } catch {
      setErrors(getSyncErrors())
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }
  }, [])

  const handleClearErrors = useCallback(() => {
    clearSyncErrors()
    setErrors([])
  }, [])

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    queuedCount,
    errors,
    sync,
    clearErrors: handleClearErrors,
  }
}
