// src/components/shared/SyncStatus.tsx
import { useState, useEffect } from 'react'
import { RefreshCw, WifiOff, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSyncStatus } from '@/hooks/use-sync-status'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

function relativeTime(date: Date | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function SyncStatus() {
  const { isOnline, isSyncing, lastSyncTime, queuedCount, errors, sync, clearErrors } =
    useSyncStatus()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  if (isCollapsed) {
    const title = !isOnline
      ? 'Offline'
      : isSyncing
        ? 'Syncing…'
        : `Last synced: ${relativeTime(lastSyncTime)}`
    return (
      <div className="flex justify-center py-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={sync}
          disabled={isSyncing || !isOnline}
          title={title}
        >
          {!isOnline ? (
            <WifiOff className="size-4" />
          ) : isSyncing ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <Wifi className="size-4" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="px-2 py-1 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground">
          {!isOnline ? (
            <WifiOff className="size-3 shrink-0" />
          ) : isSyncing ? (
            <RefreshCw className="size-3 shrink-0 animate-spin" />
          ) : errors.length > 0 ? (
            <span className="size-2 rounded-full bg-destructive shrink-0 inline-block" />
          ) : (
            <Wifi className="size-3 shrink-0" />
          )}
          <span className="truncate">
            {!isOnline ? 'Offline' : isSyncing ? 'Syncing…' : `Synced ${relativeTime(lastSyncTime)}`}
          </span>
          {queuedCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] shrink-0 font-medium">
              {queuedCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={sync}
          disabled={isSyncing || !isOnline}
        >
          <RefreshCw className={cn('size-3', isSyncing && 'animate-spin')} />
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="rounded border border-destructive/20 bg-destructive/5 p-1.5 space-y-0.5">
          {errors.map((e, i) => (
            <p key={i} className="text-[10px] text-destructive leading-tight">
              {new Date(e.timestamp).toLocaleTimeString()}: {e.message}
            </p>
          ))}
          <button
            onClick={clearErrors}
            className="text-[10px] underline text-muted-foreground hover:text-foreground"
          >
            Clear errors
          </button>
        </div>
      )}
    </div>
  )
}
