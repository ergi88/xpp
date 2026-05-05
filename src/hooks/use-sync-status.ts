// src/hooks/use-sync-status.ts
import { useState, useEffect, useCallback } from 'react'
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

  useEffect(() => {
    getQueue().then((q) => setQueuedCount(q.length))
  }, [])

  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true)
      setIsSyncing(true)
      try {
        await flushMutationQueue()
        setQueuedCount(0)
        setLastSyncedAt(getLastSyncTime())
        setErrors([])
      } catch {
        setErrors(getSyncErrors())
      } finally {
        setIsSyncing(false)
      }
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const sync = useCallback(async () => {
    if (isSyncing || !isOnline) return
    setIsSyncing(true)
    try {
      await syncAll()
      setLastSyncedAt(getLastSyncTime())
      setErrors([])
    } catch {
      setErrors(getSyncErrors())
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, isOnline])

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
