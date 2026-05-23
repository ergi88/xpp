# MobileFooterNav Redesign — react-modal-sheet + DnD

**Date:** 2026-05-23  
**Status:** Approved

---

## Overview

Replace the current fixed bottom nav + shadcn Sheet combo with `react-modal-sheet`. Collapsed state shows a single main nav row. Expanded state reveals the full nav sheet with an edit mode for customizing the 4 main nav slots via drag-and-drop.

---

## Dependencies

New installs required:
- `react-modal-sheet` — snap-to-detent bottom sheet
- `@dnd-kit/core` + `@dnd-kit/sortable` — cross-container drag-and-drop with touch support

Already present:
- `motion/react` — animations
- `react-router-dom` — NavLink / Link

---

## Files

| File | Action |
|---|---|
| `src/components/layout/MobileFooterNav.tsx` | Rewrite |
| `src/hooks/use-nav-config.ts` | Create |
| `src/components/layout/FolderSection.tsx` | Create (unused for now) |

---

## Nav Item Registry

All configurable nav items:

| id | Label | Route | Default |
|---|---|---|---|
| `dashboard` | Dashboard | `/` | main nav |
| `transactions` | Transactions | `/transactions` | main nav |
| `accounts` | Accounts | `/accounts` | main nav |
| `budgets` | Budgets | `/budgets` | main nav |
| `debts` | Debts | `/debts` | pool |
| `recurring` | Recurring | `/recurring` | pool |
| `reports` | Reports | `/reports` | pool |
| `settings` | Settings | `/settings` | pool |

The Plus button (center slot) is always fixed — not configurable, not part of DnD.

---

## Sheet States

### Collapsed (default snap point — ~72px height)

Single row: `[ Dashboard | Transactions | (+) | Accounts | Budgets ]`

The sheet handle is visible. Dragging up or tapping the handle expands it.

### Expanded (second snap point — ~60% screen height)

```
┌──────────────────────────────────────────┐
│ [ Dashboard | Transactions | (+) | Accounts | Budgets ]  [Edit] │
├──────────────────────────────────────────┤
│  Debts    Recurring    Reports    Settings                       │  ← flat grid, 4-per-row
│                                                                  │
├──────────────────────────────────────────┤
│  ⟳ Synced 2m ago                [sync]  [install?]              │  ← static, always visible
└──────────────────────────────────────────┘
```

### Edit Mode (toggled via Edit button, sheet stays expanded)

```
[ [-]Dashboard | [-]Transactions | (+) | [-]Accounts | [-]Budgets ]  [Done]
```

- Minus badge on each of the 4 main nav items (not on Plus)
- Pool items show a plus indicator
- When main nav is full (4/4): pool items are dimmed, show "Remove one first" hint on tap attempt
- Edit button label changes to "Done"; tapping Done exits edit mode
- Sheet closing also exits edit mode

---

## DnD Interactions (Edit Mode Only)

### Within main nav row
- `@dnd-kit/sortable` horizontal sort across the 4 slots
- Drag to reorder

### Remove from main nav → pool
- Tap the minus badge on a main nav item → item moves to pool immediately
- Drag a main nav item out of the row and drop on pool grid → moves to pool

### Add from pool → main nav
- **Tap** a pool item → moves to main nav (appended to end), if slots available
- **Drag** a pool item over the main nav row → drops into nearest slot, if slots available
- If main nav already has 4 items: tap shows inline hint "Remove one first", drag is rejected (item snaps back)

### DnD implementation
- Single `DndContext` wrapping the edit-mode layout
- `SortableContext` (horizontal list strategy) for the 4 main nav items
- `useDraggable` for pool items
- `useDroppable` zones: main nav row, pool grid
- `onDragEnd` handler:
  - source=pool + target=mainNav → add (if <4 items)
  - source=mainNav + target=pool → remove
  - source=mainNav + target=mainNav → reorder

---

## `useNavConfig` Hook

```ts
type NavItemId =
  | "dashboard" | "transactions" | "accounts" | "budgets"
  | "debts" | "recurring" | "reports" | "settings"

interface NavConfig {
  mainNav: NavItemId[]  // always length 4, left→right order
}

// Returns:
interface UseNavConfigReturn {
  mainNav: NavItemId[]
  pool: NavItemId[]          // derived: ALL_NAV_IDS minus mainNav
  setMainNav: (items: NavItemId[]) => void
  isLoading: boolean
}
```

**Load order:**
1. Read `localStorage("xpp:nav-config")` → render immediately (no loading flicker)
2. `useSettings` resolves → if server value differs, overwrite local state + localStorage

**Save on change:**
1. Write `localStorage("xpp:nav-config")` synchronously
2. Debounced 500ms write to `useSettings` mutation

---

## `FolderSection` Component (unused)

Generic reusable iOS-style folder popup. Extracted from current `FolderNavItem`.

```ts
interface FolderSectionProps {
  title: string
  links: { to: string; label: string; icon: LucideIcon }[]
  footer?: React.ReactNode
  showLabel?: boolean
}
```

- Active state: any link in `links` matches current pathname prefix
- Renders 2×2 icon grid button + spring-animated popover
- Closes on navigation (location change effect)
- Exported from `src/components/layout/FolderSection.tsx`
- Not used in `MobileFooterNav` — available for future placement

---

## Pool Items in Non-Edit Mode

Pool items render as `NavLink`s. Tapping one navigates and closes the sheet. No edit affordances shown.

---

## Persistence Schema

`useSettings` gains a new field: `mobile_nav_config: string` (JSON-serialized `NavConfig`).  
localStorage key: `xpp:nav-config`.

> **Note for implementation plan:** Check if `useSettings` persists to a DB — if so, a schema migration for the new field is required.

---

## Keyboard / Safe Area

- Sheet respects `env(safe-area-inset-bottom)` via react-modal-sheet's built-in safe area support
- `useKeyboardVisible` hook retained — `MobileFooterNav` returns null when keyboard visible

---

## Out of Scope

- Desktop nav unchanged
- The Plus button quick-actions sheet (expense/income/transfer) unchanged — triggered from the fixed center Plus
- Settings page nav preferences (mobile_footer_enabled, mobile_footer_labels) unchanged
