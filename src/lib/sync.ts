// src/lib/sync.ts
import { queryClient } from '@/lib/query-client'
import { getQueue, dequeue } from '@/lib/mutation-queue'
import { gasAdapter } from '@/lib/sheets/gas-adapter'
import type { SheetName } from '@/lib/sheets/adapter'

const LAST_SYNC_KEY = 'xpp-last-sync'
const ERRORS_KEY = 'xpp-sync-errors'
const MAX_ERRORS = 10

export type SyncError = { timestamp: number; message: string }

export function getLastSyncTime(): Date | null {
  const v = localStorage.getItem(LAST_SYNC_KEY)
  return v ? new Date(Number(v)) : null
}

function setLastSyncTime(): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
}

export function getSyncErrors(): SyncError[] {
  try {
    return JSON.parse(localStorage.getItem(ERRORS_KEY) ?? '[]') as SyncError[]
  } catch {
    return []
  }
}

function addSyncError(message: string): void {
  const errors = getSyncErrors()
  errors.unshift({ timestamp: Date.now(), message })
  localStorage.setItem(ERRORS_KEY, JSON.stringify(errors.slice(0, MAX_ERRORS)))
}

export function clearSyncErrors(): void {
  localStorage.removeItem(ERRORS_KEY)
}

export async function syncAll(): Promise<void> {
  try {
    await queryClient.refetchQueries()
    setLastSyncTime()
    clearSyncErrors()
  } catch (err) {
    addSyncError(err instanceof Error ? err.message : String(err))
    throw err
  }
}

export async function flushMutationQueue(): Promise<void> {
  const queue = await getQueue()
  for (const mutation of queue) {
    try {
      if (mutation.action === 'create') {
        await gasAdapter.create(mutation.sheet as SheetName, mutation.data ?? {})
      } else if (mutation.action === 'update') {
        await gasAdapter.update(
          mutation.sheet as SheetName,
          mutation.resourceId!,
          mutation.data ?? {},
        )
      } else {
        await gasAdapter.delete(mutation.sheet as SheetName, mutation.resourceId!)
      }
      await dequeue(mutation.id)
    } catch {
      break
    }
  }
  await syncAll()
}
