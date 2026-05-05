# Offline-First PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Finix work offline on phone and desktop — cache all data in IndexedDB, queue mutations when offline, add manual sync with last-fetch timestamp, and install as a PWA.

**Architecture:** TanStack Query cache is persisted to IndexedDB via `PersistQueryClientProvider`. `staleTime: Infinity` prevents auto-fetching — data only refreshes on manual sync. Mutations intercepted in `gasAdapter` — if offline, enqueued to a separate IndexedDB store and flushed in order on reconnect. Service Worker via `vite-plugin-pwa` caches app shell for offline load.

**Tech Stack:** `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `idb-keyval`, `vite-plugin-pwa` (Workbox)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Edit | Add 4 new packages |
| `src/lib/query-client.ts` | Edit | `staleTime: Infinity`, `gcTime: 7d` |
| `src/lib/persister.ts` | Create | IDB persister adapter for TQ |
| `src/app/providers.tsx` | Edit | Swap to `PersistQueryClientProvider` |
| `src/lib/mutation-queue.ts` | Create | Queue/dequeue offline mutations in IDB |
| `src/lib/sheets/gas-adapter.ts` | Edit | Intercept create/update/delete when offline |
| `src/lib/sync.ts` | Create | `syncAll()`, `flushMutationQueue()`, error log |
| `src/hooks/use-sync-status.ts` | Create | Hook: online state, sync state, queue count, errors |
| `src/hooks/use-pwa-install.ts` | Create | Hook: capture `beforeinstallprompt`, expose `install()` |
| `src/hooks/index.ts` | Edit | Export new hooks |
| `src/components/shared/SyncStatus.tsx` | Create | Sync row UI (last sync time, refresh, error list) |
| `src/components/shared/index.ts` | Edit | Export `SyncStatus` |
| `src/components/layout/Sidebar.tsx` | Edit | Add `SyncStatus` + install button to footer |
| `vite.config.ts` | Edit | Add `VitePWA` plugin |
| `public/icons/pwa-192.png` | Create | PWA icon (copy from existing assets) |
| `public/icons/pwa-512.png` | Create | PWA icon (copy from existing assets) |

---

## Task 1: Install Packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the 4 new packages**

```bash
npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval vite-plugin-pwa
```

Expected output: 4 packages added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 2: Verify installs**

```bash
node -e "require('./node_modules/@tanstack/react-query-persist-client/package.json')" && \
node -e "require('./node_modules/@tanstack/query-async-storage-persister/package.json')" && \
node -e "require('./node_modules/idb-keyval/package.json')" && \
node -e "require('./node_modules/vite-plugin-pwa/package.json')" && \
echo "All packages OK"
```

Expected: `All packages OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install offline-first PWA packages"
```

---

## Task 2: Update QueryClient Config

**Files:**
- Modify: `src/lib/query-client.ts`

Current file has `staleTime: 5 * 60 * 1000`. Change to `Infinity` so data never auto-refetches. Add `gcTime: 7 days` so cache survives long sessions.

- [ ] **Step 1: Replace the file contents**

```ts
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
    },
  },
})
```

- [ ] **Step 2: Run dev server and verify no console errors**

```bash
npm run dev
```

Open `http://localhost:5178`. Navigate to any page. Confirm data still loads (from network on first load). No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/query-client.ts
git commit -m "feat(sync): set staleTime Infinity and gcTime 7d — manual sync only"
```

---

## Task 3: Create IDB Persister

**Files:**
- Create: `src/lib/persister.ts`

`createAsyncStoragePersister` from `@tanstack/query-async-storage-persister` expects a storage object with async `getItem`, `setItem`, `removeItem`. `idb-keyval` provides exactly these as individual functions — we wrap them into the interface.

- [ ] **Step 1: Create the file**

```ts
// src/lib/persister.ts
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const val = await get<string>(key)
    return val ?? null
  },
  setItem: (key: string, value: string): Promise<void> => set(key, value),
  removeItem: (key: string): Promise<void> => del(key),
}

export const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'xpp-query-cache',
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/persister.ts
git commit -m "feat(sync): add IDB persister for TanStack Query cache"
```

---

## Task 4: Wire Up PersistQueryClientProvider

**Files:**
- Modify: `src/app/providers.tsx`

Swap `QueryClientProvider` for `PersistQueryClientProvider`. This wraps the same `queryClient` but serializes its cache to IndexedDB after every mutation/query and restores it on startup.

- [ ] **Step 1: Replace the file**

```tsx
// src/app/providers.tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient } from '@/lib/query-client'
import { persister } from '@/lib/persister'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      }}
    >
      {children}
      <Toaster position="top-right" richColors />
    </PersistQueryClientProvider>
  )
}
```

- [ ] **Step 2: Test persistence manually**

```bash
npm run dev
```

1. Open `http://localhost:5178`, navigate to Transactions — wait for data to load.
2. Open DevTools → Application → IndexedDB → look for `xpp-query-cache` store. Should contain serialized cache entries.
3. Hard-refresh the page (`Cmd+Shift+R`). Data should appear **instantly** without a network spinner.

- [ ] **Step 3: Commit**

```bash
git add src/app/providers.tsx
git commit -m "feat(sync): persist TQ cache to IndexedDB via PersistQueryClientProvider"
```

---

## Task 5: Create Mutation Queue

**Files:**
- Create: `src/lib/mutation-queue.ts`

This module stores pending offline mutations in IndexedDB under key `xpp-mutation-queue`. The queue is a plain array — append on enqueue, remove by id on dequeue.

- [ ] **Step 1: Create the file**

```ts
// src/lib/mutation-queue.ts
import { get, set } from 'idb-keyval'

export type QueuedMutation = {
  id: string
  sheet: string
  action: 'create' | 'update' | 'delete'
  data?: Record<string, unknown>
  resourceId?: string
  timestamp: number
}

const KEY = 'xpp-mutation-queue'

export async function getQueue(): Promise<QueuedMutation[]> {
  return (await get<QueuedMutation[]>(KEY)) ?? []
}

export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'timestamp'>,
): Promise<void> {
  const queue = await getQueue()
  queue.push({ ...mutation, id: crypto.randomUUID(), timestamp: Date.now() })
  await set(KEY, queue)
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue()
  await set(KEY, queue.filter((m) => m.id !== id))
}

export async function clearQueue(): Promise<void> {
  await set(KEY, [])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mutation-queue.ts
git commit -m "feat(sync): add offline mutation queue backed by IndexedDB"
```

---

## Task 6: Add Offline Intercept to GAS Adapter

**Files:**
- Modify: `src/lib/sheets/gas-adapter.ts`

When `!navigator.onLine`, `create`/`update`/`delete` enqueue the mutation and return an optimistic response instead of calling GAS. GET operations are unchanged — TQ serves them from IndexedDB cache automatically (they never hit GAS when staleTime is Infinity).

- [ ] **Step 1: Replace the file**

```ts
// src/lib/sheets/gas-adapter.ts
import type { DataAdapter, SheetName } from './adapter'
import { enqueue } from '@/lib/mutation-queue'

const url = () => {
  const u = import.meta.env.VITE_GAS_URL as string
  if (!u) throw new Error('VITE_GAS_URL is not set')
  return u
}

async function get(
  resource: SheetName,
  action: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const u = new URL(url())
  u.searchParams.set('resource', resource)
  u.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u.toString())
  const json = (await res.json()) as { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

async function post(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(url(), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

export const gasAdapter: DataAdapter = {
  getAll: (sheet) =>
    get(sheet, 'getAll') as Promise<Record<string, unknown>[]>,

  getById: (sheet, id) =>
    get(sheet, 'getById', { id }) as Promise<Record<string, unknown> | null>,

  create: async (sheet, data) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'create', data })
      return data
    }
    return post({ action: 'create', resource: sheet, data }) as Promise<Record<string, unknown>>
  },

  update: async (sheet, id, data) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'update', resourceId: id, data })
      return { ...data, id }
    }
    return post({ action: 'update', resource: sheet, id, data }) as Promise<Record<string, unknown>>
  },

  delete: async (sheet, id) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'delete', resourceId: id })
      return
    }
    await post({ action: 'delete', resource: sheet, id })
  },
}
```

- [ ] **Step 2: Test offline mutations**

```bash
npm run dev
```

1. Load app, let data hydrate.
2. DevTools → Network tab → set throttling to **Offline**.
3. Try creating a transaction. Should succeed (no error toast). 
4. Open DevTools → Application → IndexedDB → `xpp-mutation-queue`. Should show 1 queued entry.
5. Re-enable network. Entry should be processed on reconnect (Task 7 wires the flush — verify after Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/gas-adapter.ts
git commit -m "feat(sync): queue mutations when offline, return optimistic response"
```

---

## Task 7: Create Sync Module

**Files:**
- Create: `src/lib/sync.ts`

Central sync logic: `syncAll()` refetches all TQ queries and records the timestamp. `flushMutationQueue()` drains the queue to GAS in order, then calls `syncAll()` to re-hydrate from server truth. Error log stored in localStorage (max 10, newest first), cleared on successful sync.

`flushMutationQueue` imports `gasAdapter` directly (not the proxy in `sheets/index.ts`) to avoid infinite recursion through the offline check — during flush we are online.

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test flush manually**

```bash
npm run dev
```

1. Go offline (DevTools → Network → Offline).
2. Create a transaction — confirm it queues.
3. Go back online — `flushMutationQueue` isn't wired to UI yet, but you can test via browser console:
```js
import('/src/lib/sync.ts').then(m => m.flushMutationQueue())
```
Confirm the queued mutation disappears from IndexedDB and GAS receives it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat(sync): add syncAll and flushMutationQueue with error log"
```

---

## Task 8: Create useSyncStatus Hook

**Files:**
- Create: `src/hooks/use-sync-status.ts`
- Modify: `src/hooks/index.ts`

Hook exposes all state the `SyncStatus` component needs. Listens to `online`/`offline` events — auto-flushes queue on reconnect. Updates `queuedCount` and `errors` reactively.

- [ ] **Step 1: Create the hook**

```ts
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
```

- [ ] **Step 2: Export from hooks index**

Add this line to `src/hooks/index.ts`:

```ts
export * from './use-sync-status'
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-sync-status.ts src/hooks/index.ts
git commit -m "feat(sync): add useSyncStatus hook with online/offline event handling"
```

---

## Task 9: Create SyncStatus Component

**Files:**
- Create: `src/components/shared/SyncStatus.tsx`
- Modify: `src/components/shared/index.ts`

Renders a sync row in the sidebar footer. Shows last sync time (relative, refreshes every minute), online/offline icon, spinner while syncing, queued count badge, persistent error list with clear button. Handles collapsed sidebar (icon-only mode).

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Export from shared index**

Add to `src/components/shared/index.ts`:

```ts
export { SyncStatus } from './SyncStatus'
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/SyncStatus.tsx src/components/shared/index.ts
git commit -m "feat(sync): add SyncStatus component with error log and offline indicator"
```

---

## Task 10: Create usePWAInstall Hook

**Files:**
- Create: `src/hooks/use-pwa-install.ts`
- Modify: `src/hooks/index.ts`

`beforeinstallprompt` fires when the browser determines the PWA criteria are met and the app is not already installed. We defer the event and trigger it on button click. `canInstall` goes false after successful install.

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/use-pwa-install.ts
import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }
    const onInstalled = () => {
      setCanInstall(false)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setCanInstall(false)
      setPrompt(null)
    }
  }

  return { canInstall, install }
}
```

- [ ] **Step 2: Export from hooks index**

Add to `src/hooks/index.ts`:

```ts
export * from './use-pwa-install'
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-pwa-install.ts src/hooks/index.ts
git commit -m "feat(pwa): add usePWAInstall hook for beforeinstallprompt"
```

---

## Task 11: Update Sidebar Footer

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

Add `SyncStatus` and a PWA install button to `SidebarFooter`. Order (top to bottom): SyncStatus → install button (only when `canInstall`) → existing Finix/version row.

- [ ] **Step 1: Add imports at the top of the file**

Add to the existing imports in `src/components/layout/Sidebar.tsx`:

```ts
import { Download } from 'lucide-react'
import { SyncStatus } from '@/components/shared/SyncStatus'
import { usePWAInstall } from '@/hooks/use-pwa-install'
```

- [ ] **Step 2: Add hook call inside AppSidebar component**

Inside `AppSidebar`, after the existing `const { setOpenMobile } = useSidebar()` line, add:

```ts
const { canInstall, install } = usePWAInstall()
```

- [ ] **Step 3: Replace SidebarFooter content**

Replace the existing `<SidebarFooter>` block (lines 237–273 in the current file) with:

```tsx
<SidebarFooter>
    <SyncStatus />

    {canInstall && (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={install}
                    tooltip="Install app"
                    className="text-xs text-muted-foreground"
                >
                    <Download />
                    <span>Install app</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    )}

    <SidebarMenu>
        <SidebarMenuItem>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        size="sm"
                        className="text-xs text-muted-foreground justify-between"
                    >
                        <span>Finix</span>
                        <span className="font-mono">
                            {APP_VERSION}
                        </span>
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-64"
                >
                    <DropdownMenuLabel>
                        About Finix
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                        <p>
                            Self-hosted personal finance tracker.
                            Track expenses, manage budgets, and take
                            control of your money.
                        </p>
                    </div>
                    <DropdownMenuSeparator />
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    </SidebarMenu>
</SidebarFooter>
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:5178`. The sidebar footer should show the sync row above the Finix version button. Collapse the sidebar — the sync row should show an icon only. The install button won't appear in dev (PWA not registered yet — appears after Task 12+13 on a build).

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sync): add SyncStatus and PWA install button to sidebar footer"
```

---

## Task 12: Copy PWA Icons to Public

**Files:**
- Create: `public/icons/pwa-192.png`
- Create: `public/icons/pwa-512.png`

Icons already exist at `src/assets/favicon/`. PWA manifest icons must be served as static assets from `public/`.

- [ ] **Step 1: Create public/icons directory and copy icons**

```bash
mkdir -p public/icons
cp src/assets/favicon/web-app-manifest-192x192.png public/icons/pwa-192.png
cp src/assets/favicon/web-app-manifest-512x512.png public/icons/pwa-512.png
```

- [ ] **Step 2: Verify files exist**

```bash
ls -lh public/icons/
```

Expected: `pwa-192.png` and `pwa-512.png` listed.

- [ ] **Step 3: Commit**

```bash
git add public/icons/
git commit -m "feat(pwa): add PWA icons to public directory"
```

---

## Task 13: Configure vite-plugin-pwa

**Files:**
- Modify: `vite.config.ts`

`VitePWA` generates a service worker that caches the app shell. GAS API calls use `NetworkOnly` — TQ/IndexedDB handles offline reads, the SW should never cache GAS responses. Static assets use precaching (handled automatically by Workbox's `globPatterns`).

- [ ] **Step 1: Replace vite.config.ts**

```ts
// vite.config.ts
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/script\.google\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Finix',
        short_name: 'Finix',
        description: 'Personal finance tracker',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('dev'),
  },
  server: {
    port: 5178,
    allowedHosts: true,
  },
})
```

- [ ] **Step 2: Build and preview to test PWA**

```bash
npm run build && npm run preview
```

Open `http://localhost:4173` in Chrome. Open DevTools → Application → Service Workers. Confirm a service worker is registered. Check Application → Manifest — should show Finix with icons.

- [ ] **Step 3: Test install prompt**

In Chrome on desktop: look for the install icon in the address bar (appears when PWA criteria met). On phone: open via mobile browser, use "Add to Home Screen". The install button in the sidebar footer should appear when `beforeinstallprompt` fires.

- [ ] **Step 4: Test full offline flow**

1. Open `http://localhost:4173`, let all pages load.
2. DevTools → Network → Offline.
3. Hard-refresh. App should load from service worker.
4. Navigate to Transactions, Accounts, Budgets — all should show cached data instantly.
5. Create a transaction while offline — should succeed optimistically.
6. Re-enable network — queue should flush, sync row should update "Just now".

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts
git commit -m "feat(pwa): configure vite-plugin-pwa with Workbox for offline app shell"
```

---

## Done

All 8 resources (transactions, accounts, categories, currencies, tags, budgets, recurring, debts) are now cached in IndexedDB and served instantly on navigation. Manual-only sync via refresh button. Offline mutations queue and flush on reconnect. Sync errors persist on screen. App installs as PWA on phone and desktop.
