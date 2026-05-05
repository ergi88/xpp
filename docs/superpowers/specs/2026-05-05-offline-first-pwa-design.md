# Offline-First PWA Design

**Date:** 2026-05-05  
**App:** Finix (xpp) — React + Vite + TanStack Query → Google Apps Script → Google Sheets

## Problem

App makes fetch calls on every navigation. GAS is slow (~1-3s per request). No offline support. User wants instant navigation, phone usability, and manual-only sync with a visible last-fetch timestamp.

## Approach

TanStack Query persist-client (Approach A): persist TQ cache to IndexedDB, set `staleTime: Infinity` so data never auto-refetches, manual refresh only. Offline mutations queue via `idb-keyval`. PWA shell via `vite-plugin-pwa`.

## New Packages

| Package | Purpose |
|---|---|
| `@tanstack/react-query-persist-client` | Wraps QueryClientProvider with IndexedDB persistence |
| `@tanstack/query-idb-persister` | IDB persister adapter for TQ |
| `idb-keyval` | Lightweight key-value IndexedDB store for mutation queue + sync metadata |
| `vite-plugin-pwa` | Service worker, web app manifest, Workbox config |

## Architecture

```
GAS (Google Sheets)
       ↑ fetch on demand only (manual refresh)
       ↓ mutations flush async (or queue if offline)
  TanStack Query Client
  staleTime: Infinity | gcTime: 7 days
       ↕ persist / hydrate on startup
  IndexedDB — key: 'xpp-query-cache'
  (all resource data lives here between sessions)
       +
  Mutation Queue — key: 'xpp-mutation-queue' (idb-keyval)
  (offline mutations queued, flushed in order on reconnect)
       +
  Sync Metadata — key: 'xpp-last-sync', 'xpp-sync-errors' (localStorage)
       +
  Service Worker (Workbox via vite-plugin-pwa)
  (caches JS/CSS/assets — app shell works offline)
```

**Cold start flow:** App loads → `PersistQueryClientProvider` hydrates TQ cache from IndexedDB → all pages render instantly with cached data → no network call made.

**Refresh flow:** User clicks refresh → `syncAll()` calls `queryClient.refetchQueries()` → GAS fetched for all 8 resources (transactions, accounts, categories, currencies, tags, budgets, recurring, debts) → IndexedDB updated → `xpp-last-sync` timestamp written.

**Offline mutation flow:** User creates/updates/deletes → `api/client.ts` checks `navigator.onLine` → if offline, enqueues to `xpp-mutation-queue` → returns optimistic response → on `window.online` event, queue flushes in chronological order to GAS.

**Conflict strategy:** Last-write-wins. Queue processes in order. Appropriate for single-user app.

## Data Layer Changes

### `src/lib/query-client.ts`
```ts
defaultOptions: {
  queries: {
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  }
}
```

### `src/lib/persister.ts` (new)
```ts
import { createIDBPersister } from '@tanstack/query-idb-persister'
export const persister = createIDBPersister('xpp-query-cache')
```

### `src/app/providers.tsx`
Replace `QueryClientProvider` with `PersistQueryClientProvider`:
```tsx
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister }}
>
```
Note: `onSuccess` callback fires on IDB hydration (cold start), NOT on GAS fetch — do NOT write `lastSyncTime` here. `syncAll()` is the only writer of that timestamp.

### `src/lib/sync.ts` (new)
- `syncAll()` — `queryClient.refetchQueries()` for all resources, writes timestamp on success, appends to error log on failure
- `getLastSyncTime(): Date | null` — reads `xpp-last-sync` from localStorage
- `getSyncErrors(): SyncError[]` — reads `xpp-sync-errors` from localStorage (max 10, newest first)
- `clearSyncErrors()` — clears error log

### `src/api/client.ts`
Thin offline intercept layer: wraps the base `fetch` call. If `!navigator.onLine` on POST/PATCH/DELETE → enqueue mutation via `mutation-queue.ts` → return optimistic stub. GET requests bypass this (TQ serves from IndexedDB cache — GAS never called).

### `src/lib/mutation-queue.ts` (new)
```ts
type QueuedMutation = {
  id: string           // uuid
  resource: string     // 'transactions' | 'accounts' | ...
  action: 'create' | 'update' | 'delete'
  data: unknown
  resourceId?: string  // for update/delete
  timestamp: number
}
// get/set 'xpp-mutation-queue' via idb-keyval
// enqueue(), flush(), getQueue(), clearQueue()
```

## Sync Status Hook + Component

### `src/hooks/use-sync-status.ts` (new)
```ts
{
  lastSyncTime: Date | null
  isSyncing: boolean
  isOnline: boolean
  queuedCount: number
  errors: SyncError[]
  sync: () => void
  clearErrors: () => void
}
```
- `isOnline`: `navigator.onLine` + event listeners
- `queuedCount`: length of `xpp-mutation-queue` from idb-keyval
- Polling: none — updates on sync events and online/offline events only

### `src/components/shared/SyncStatus.tsx` (new)
Placed in `SidebarFooter` above the version row in [Sidebar.tsx](src/components/layout/Sidebar.tsx).

States:
| State | Display |
|---|---|
| Online, synced | `Last synced: 3h ago` + refresh icon button |
| Syncing | Spinner + "Syncing…" |
| Offline | Wifi-off icon + "Offline" |
| Queued mutations | Badge with count next to status |
| Sync errors | Red dot + expandable error list below button |

Error list: inline below the sync row, not a modal. Shows timestamp + message per error. "Clear errors" link. Errors persist until cleared or next successful sync.

Collapsed sidebar: icon-only mode shows wifi/spinner/wifi-off icon with tooltip.

## PWA

### `vite.config.ts`
```ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      { urlPattern: /script\.google\.com/, handler: 'NetworkOnly' },
      { urlPattern: /\/assets\//, handler: 'CacheFirst' },
    ]
  },
  manifest: {
    name: 'Finix',
    short_name: 'Finix',
    description: 'Personal finance tracker',
    theme_color: '#000000',
    display: 'standalone',
    icons: [
      { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
    ]
  }
})
```

### `src/hooks/use-pwa-install.ts` (new)
```ts
{
  canInstall: boolean   // true when beforeinstallprompt available
  install: () => void   // triggers native install prompt
}
```
Captures `beforeinstallprompt`, defers it, triggers on `install()` call. `canInstall` becomes false after install (event fires `appinstalled`).

### Install button in Sidebar
Added to `SidebarFooter` above the Finix/version row. Uses `Download` icon from lucide-react. Only renders when `canInstall === true`. Collapsed sidebar: icon + tooltip "Install app".

## Files Changed / Created

| File | Action |
|---|---|
| `src/lib/query-client.ts` | Edit — add staleTime/gcTime defaults |
| `src/lib/persister.ts` | Create |
| `src/lib/sync.ts` | Create |
| `src/lib/mutation-queue.ts` | Create |
| `src/app/providers.tsx` | Edit — PersistQueryClientProvider |
| `src/api/client.ts` | Edit — offline intercept |
| `src/hooks/use-sync-status.ts` | Create |
| `src/hooks/use-pwa-install.ts` | Create |
| `src/components/shared/SyncStatus.tsx` | Create |
| `src/components/layout/Sidebar.tsx` | Edit — add SyncStatus + install button to footer |
| `vite.config.ts` | Edit — add vite-plugin-pwa |
| `public/icons/pwa-192.png` | Create (placeholder) |
| `public/icons/pwa-512.png` | Create (placeholder) |
| `package.json` | Edit — add 4 new packages |
