# MobileFooterNav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MobileFooterNav with a react-modal-sheet that collapses to a 1-row nav bar and expands to show a customizable nav with DnD-based main nav editing.

**Architecture:** A react-modal-sheet always mounted at `isOpen={true}` snaps between a collapsed nav-bar state and an expanded sheet. A `useNavConfig` hook manages the 4 main-nav slots (persisted to localStorage + Settings). Edit mode activates `@dnd-kit` for reordering main nav and drag/tap to add from the pool.

**Tech Stack:** react-modal-sheet, @dnd-kit/core, @dnd-kit/sortable, motion/react, react-router-dom, vitest/jsdom

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/types/settings.ts` | Add `mobile_nav_config?: string` field |
| Modify | `src/api/settings.ts` | Add default + syncFromSheet handling for new field |
| Create | `src/hooks/use-nav-config.ts` | Nav order state, localStorage + settings persistence, pool derivation |
| Create | `src/hooks/__tests__/use-nav-config.test.ts` | Tests for `parseNavConfig` helper |
| Create | `src/components/layout/FolderSection.tsx` | Reusable iOS folder popup (unused for now) |
| Rewrite | `src/components/layout/MobileFooterNav.tsx` | Sheet shell, nav row, expanded pool, edit mode, DnD |

---

## Task 1: Install Dependencies

**Files:** none (package.json)

- [ ] **Step 1: Install packages**

```bash
npm install react-modal-sheet @dnd-kit/core @dnd-kit/sortable
```

Expected: no errors, packages appear in `node_modules`.

- [ ] **Step 2: Verify TypeScript types are available**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: same errors as before (if any), no new "Cannot find module" errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-modal-sheet and dnd-kit dependencies"
```

---

## Task 2: Extend Settings Type and API

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/api/settings.ts`

- [ ] **Step 1: Add `mobile_nav_config` to Settings interface**

In `src/types/settings.ts`, replace the entire file:

```ts
export interface Settings {
  auto_update_currencies: boolean;
  hide_amounts: boolean;
  lock_enabled: boolean;
  lock_timeout_minutes: number;
  mobile_footer_enabled: boolean;
  mobile_footer_labels: boolean;
  mobile_nav_config?: string;
}
```

- [ ] **Step 2: Add default and syncFromSheet handling**

In `src/api/settings.ts`, update the `defaults` object:

```ts
const defaults: Settings = {
  auto_update_currencies: false,
  hide_amounts: false,
  lock_enabled: true,
  lock_timeout_minutes: 5,
  mobile_footer_enabled: true,
  mobile_footer_labels: true,
  mobile_nav_config: undefined,
};
```

In the same file, inside `syncFromSheet`, add before the `if (Object.keys(updates).length > 0)` block:

```ts
if (map.mobile_nav_config !== undefined)
  updates.mobile_nav_config = map.mobile_nav_config;
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/settings.ts src/api/settings.ts
git commit -m "feat: add mobile_nav_config field to Settings"
```

---

## Task 3: Create `useNavConfig` Hook (TDD)

**Files:**
- Create: `src/hooks/use-nav-config.ts`
- Create: `src/hooks/__tests__/use-nav-config.test.ts`

- [ ] **Step 1: Write failing tests for `parseNavConfig`**

Create `src/hooks/__tests__/use-nav-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseNavConfig, DEFAULT_MAIN_NAV, ALL_NAV_IDS } from "../use-nav-config";

describe("parseNavConfig", () => {
  it("returns DEFAULT_MAIN_NAV when input is undefined", () => {
    expect(parseNavConfig(undefined)).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when input is empty string", () => {
    expect(parseNavConfig("")).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when JSON is invalid", () => {
    expect(parseNavConfig("not-json")).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when array has wrong length", () => {
    expect(parseNavConfig(JSON.stringify(["dashboard", "transactions"]))).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns DEFAULT_MAIN_NAV when array contains invalid ids", () => {
    expect(
      parseNavConfig(JSON.stringify(["dashboard", "transactions", "accounts", "INVALID"]))
    ).toEqual(DEFAULT_MAIN_NAV);
  });

  it("returns parsed array when valid 4-item array of known ids", () => {
    const custom = ["debts", "recurring", "reports", "settings"];
    expect(parseNavConfig(JSON.stringify(custom))).toEqual(custom);
  });

  it("DEFAULT_MAIN_NAV has exactly 4 items all in ALL_NAV_IDS", () => {
    expect(DEFAULT_MAIN_NAV).toHaveLength(4);
    DEFAULT_MAIN_NAV.forEach((id) => expect(ALL_NAV_IDS).toContain(id));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/__tests__/use-nav-config.test.ts
```

Expected: FAIL — `Cannot find module '../use-nav-config'`

- [ ] **Step 3: Create the hook**

Create `src/hooks/use-nav-config.ts`:

```ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, Receipt, CreditCard, PiggyBank,
  HandCoins, Repeat, BarChart3, Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSettings } from "@/hooks";
import { settingsApi } from "@/api";

export type NavItemId =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "budgets"
  | "debts"
  | "recurring"
  | "reports"
  | "settings";

export interface NavItemConfig {
  id: NavItemId;
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
}

export const NAV_ITEM_REGISTRY: Record<NavItemId, NavItemConfig> = {
  dashboard:    { id: "dashboard",    label: "Dashboard",    icon: Home,          to: "/",              end: true },
  transactions: { id: "transactions", label: "Transactions", icon: Receipt,       to: "/transactions" },
  accounts:     { id: "accounts",     label: "Accounts",     icon: CreditCard,    to: "/accounts" },
  budgets:      { id: "budgets",      label: "Budgets",      icon: PiggyBank,     to: "/budgets" },
  debts:        { id: "debts",        label: "Debts",        icon: HandCoins,     to: "/debts" },
  recurring:    { id: "recurring",    label: "Recurring",    icon: Repeat,        to: "/recurring" },
  reports:      { id: "reports",      label: "Reports",      icon: BarChart3,     to: "/reports" },
  settings:     { id: "settings",     label: "Settings",     icon: SettingsIcon,  to: "/settings" },
};

export const ALL_NAV_IDS: NavItemId[] = [
  "dashboard", "transactions", "accounts", "budgets",
  "debts", "recurring", "reports", "settings",
];

export const DEFAULT_MAIN_NAV: NavItemId[] = [
  "dashboard", "transactions", "accounts", "budgets",
];

const LS_KEY = "xpp:nav-config";

export function parseNavConfig(raw: string | undefined): NavItemId[] {
  try {
    if (!raw) return DEFAULT_MAIN_NAV;
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 4 ||
      !parsed.every((id) => ALL_NAV_IDS.includes(id as NavItemId))
    ) {
      return DEFAULT_MAIN_NAV;
    }
    return parsed as NavItemId[];
  } catch {
    return DEFAULT_MAIN_NAV;
  }
}

export function useNavConfig() {
  const { data: settings } = useSettings();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mainNav, setMainNavState] = useState<NavItemId[]>(() =>
    parseNavConfig(localStorage.getItem(LS_KEY) ?? undefined)
  );

  useEffect(() => {
    if (!settings?.mobile_nav_config) return;
    const serverNav = parseNavConfig(settings.mobile_nav_config);
    setMainNavState((prev) => {
      if (prev.join(",") === serverNav.join(",")) return prev;
      localStorage.setItem(LS_KEY, JSON.stringify(serverNav));
      return serverNav;
    });
  }, [settings?.mobile_nav_config]);

  const setMainNav = useCallback((items: NavItemId[]) => {
    setMainNavState(items);
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      settingsApi.update({ mobile_nav_config: JSON.stringify(items) }).catch(() => {});
    }, 500);
  }, []);

  const pool = ALL_NAV_IDS.filter((id) => !mainNav.includes(id));

  return { mainNav, pool, setMainNav };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/use-nav-config.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-nav-config.ts src/hooks/__tests__/use-nav-config.test.ts
git commit -m "feat: add useNavConfig hook with parseNavConfig and localStorage persistence"
```

---

## Task 4: Create FolderSection Component (Unused)

**Files:**
- Create: `src/components/layout/FolderSection.tsx`

This is an extraction of the existing `FolderNavItem` into a reusable component. It is not used anywhere yet.

- [ ] **Step 1: Create the component**

Create `src/components/layout/FolderSection.tsx`:

```tsx
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FolderSectionLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface FolderSectionProps {
  title: string;
  links: FolderSectionLink[];
  footer?: React.ReactNode;
  showLabel?: boolean;
}

export function FolderSection({ title, links, footer, showLabel }: FolderSectionProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isActive = links.some((l) => location.pathname.startsWith(l.to));

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const [Icon0, Icon1, Icon2, Icon3] = links.slice(0, 4).map((l) => l.icon);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
        aria-label={title}
        aria-expanded={open}
      >
        <div
          className={cn(
            "size-12 rounded-[5px] grid grid-cols-2 place-items-center gap-px p-1",
            "ring-1 ring-border/60",
            isActive && "ring-primary/40",
          )}
        >
          {Icon0 && <Icon0 className="size-3" />}
          {Icon1 && <Icon1 className="size-3" />}
          {Icon2 && <Icon2 className="size-3" />}
          {Icon3 && <Icon3 className="size-3" />}
        </div>
        {showLabel && <span className="text-[11px]">{title}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{ type: "spring", damping: 22, stiffness: 380, mass: 0.8 }}
              style={{ transformOrigin: "100% 100%" }}
              className="absolute bottom-full right-0 z-50 mb-3 w-52 overflow-hidden rounded-2xl border bg-background/90 shadow-2xl backdrop-blur-xl"
            >
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {title}
                </p>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5">
                {links.map((link, i) => {
                  const Icon = link.icon;
                  const active = location.pathname.startsWith(link.to);
                  return (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.18 }}
                    >
                      <Link
                        to={link.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              {footer && (
                <div className="mx-3 mb-2.5 mt-1 border-t pt-2">
                  {footer}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/FolderSection.tsx
git commit -m "feat: add FolderSection reusable component (unused)"
```

---

## Task 5: Rewrite MobileFooterNav — Sheet + Nav Row + Expanded Pool

**Files:**
- Rewrite: `src/components/layout/MobileFooterNav.tsx`

This task builds the sheet structure without edit mode. Edit mode is added in Task 6.

- [ ] **Step 1: Replace MobileFooterNav.tsx with the new implementation**

Completely replace `src/components/layout/MobileFooterNav.tsx`:

```tsx
import { useState, useRef, useMemo, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Download,
  HandCoins,
  PiggyBank,
  Plus,
  RefreshCw,
  Repeat,
  Wifi,
  WifiOff,
} from "lucide-react";
import Sheet, { type SheetRef } from "react-modal-sheet";
import { Button } from "@/components/ui/button";
import {
  Sheet as ShadSheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/hooks";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useNavConfig } from "@/hooks/use-nav-config";
import { NAV_ITEM_REGISTRY } from "@/hooks/use-nav-config";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "expense",   label: "New expense",   to: "/transactions/create?type=expense",  icon: ArrowUpRight },
  { id: "income",    label: "New income",    to: "/transactions/create?type=income",   icon: ArrowDownLeft },
  { id: "transfer",  label: "Transfer",      to: "/transactions/create?type=transfer", icon: ArrowLeftRight },
  { id: "budget",    label: "New budget",    to: "/budgets/create",                    icon: PiggyBank },
  { id: "account",   label: "New account",   to: "/accounts/create",                   icon: CreditCard },
  { id: "debt",      label: "New debt",      to: "/debts/create",                      icon: HandCoins },
  { id: "recurring", label: "New recurring", to: "/recurring/create",                  icon: Repeat },
];

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!window.visualViewport) return;
    const viewport = window.visualViewport;
    const handleResize = () => setVisible(window.innerHeight - viewport.height > 120);
    handleResize();
    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);
  return visible;
}

function SyncFooter() {
  const { isOnline, isSyncing, lastSyncTime, sync } = useSyncStatus();
  const { canInstall, install } = usePWAInstall();

  const syncLabel = !isOnline
    ? "Offline"
    : isSyncing
    ? "Syncing…"
    : lastSyncTime
    ? `Synced ${(() => {
        const mins = Math.floor((Date.now() - lastSyncTime.getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const h = Math.floor(mins / 60);
        return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
      })()}`
    : "Never synced";

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
        {!isOnline ? (
          <WifiOff className="size-3 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="size-3 shrink-0 animate-spin" />
        ) : (
          <Wifi className="size-3 shrink-0" />
        )}
        <span className="truncate">{syncLabel}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={sync}
          disabled={isSyncing || !isOnline}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          aria-label="Sync now"
        >
          <RefreshCw className={cn("size-3.5", isSyncing && "animate-spin")} />
        </button>
        {canInstall && (
          <button
            onClick={install}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Install app"
          >
            <Download className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function MobileFooterNav() {
  const isMobile = useIsMobile();
  const keyboardVisible = useKeyboardVisible();
  const location = useLocation();
  const { data: settings } = useSettings();
  const enabled = settings?.mobile_footer_enabled ?? true;
  const { mainNav, pool } = useNavConfig();

  const sheetRef = useRef<SheetRef>(null);
  const [snapIndex, setSnapIndex] = useState(1);
  const isExpanded = snapIndex === 0;

  const COLLAPSED_HEIGHT = 76;
  const EXPANDED_HEIGHT = Math.round(
    typeof window !== "undefined" ? window.innerHeight * 0.58 : 500
  );

  const preferredAction = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/budgets")) return "budget";
    if (path.startsWith("/accounts")) return "account";
    return "expense";
  }, [location.pathname]);

  const orderedActions = useMemo(
    () => [...ACTIONS].sort((a, b) => (a.id === preferredAction ? -1 : b.id === preferredAction ? 1 : 0)),
    [preferredAction]
  );

  // Close expanded when navigating
  useEffect(() => {
    sheetRef.current?.snapTo(1);
  }, [location.pathname]);

  if (!isMobile || !enabled || keyboardVisible) return null;

  return (
    <Sheet
      ref={sheetRef}
      isOpen={true}
      onClose={() => sheetRef.current?.snapTo(1)}
      snapPoints={[EXPANDED_HEIGHT, COLLAPSED_HEIGHT]}
      initialSnap={1}
      onSnap={setSnapIndex}
      style={{ zIndex: 40 }}
    >
      <Sheet.Container
        style={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
        className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t"
      >
        <Sheet.Header disableDrag={false} />
        <Sheet.Content disableDrag={false} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* Main nav row */}
          <div className="grid grid-cols-5 items-center gap-1 px-2 pt-1 pb-2">
            {mainNav.map((id) => {
              const item = NAV_ITEM_REGISTRY[id];
              const Icon = item.icon;
              return (
                <NavLink
                  key={id}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
                      isActive && "text-primary"
                    )
                  }
                  aria-label={item.label}
                >
                  <Icon className="size-5" />
                  <span className="text-[11px]">{item.label}</span>
                </NavLink>
              );
            })}

            {/* Plus — always center (col 3) */}
            <ShadSheet>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  className="mx-auto size-12 rounded-full shadow-lg"
                  aria-label="Quick actions"
                  style={{ gridColumn: 3, gridRow: 1 }}
                >
                  <Plus className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <SheetHeader>
                  <SheetTitle>Quick actions</SheetTitle>
                  <SheetDescription>Start a new transaction or add supporting data.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  {orderedActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <SheetClose key={action.id} asChild>
                        <Button asChild variant="ghost" className="justify-center gap-3 border border-muted">
                          <Link to={action.to}>
                            <ActionIcon className="size-4" />
                            {action.label}
                          </Link>
                        </Button>
                      </SheetClose>
                    );
                  })}
                </div>
              </SheetContent>
            </ShadSheet>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="flex flex-col overflow-y-auto">
              {/* Pool grid */}
              {pool.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="grid grid-cols-4 gap-1">
                    {pool.map((id) => {
                      const item = NAV_ITEM_REGISTRY[id];
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={id}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            cn(
                              "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs text-muted-foreground transition-colors",
                              isActive && "text-primary bg-primary/5"
                            )
                          }
                          aria-label={item.label}
                        >
                          <Icon className="size-5" />
                          <span className="text-[11px]">{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}

              <SyncFooter />
            </div>
          )}
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop
        onTap={() => sheetRef.current?.snapTo(1)}
        style={{ background: "transparent" }}
      />
    </Sheet>
  );
}
```

> **Note:** The `grid-cols-5` layout with the Plus button always in column 3 is controlled by the order of items — main nav renders left-2-slots, then Plus, then right-2-slots. The 4 `mainNav` ids need to be split: first 2 go left, last 2 go right. Update the main nav row grid accordingly.

- [ ] **Step 2: Fix the main nav row grid (split 4 items around center Plus)**

The grid renders all 4 NavLinks then the Plus button — but in `grid-cols-5`, we need items 0-1 in cols 1-2, Plus in col 3, items 2-3 in cols 4-5. Replace the `grid grid-cols-5` section with:

```tsx
<div className="grid grid-cols-5 items-center gap-1 px-2 pt-1 pb-2">
  {/* Left 2 nav items */}
  {mainNav.slice(0, 2).map((id) => {
    const item = NAV_ITEM_REGISTRY[id];
    const Icon = item.icon;
    return (
      <NavLink
        key={id}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
            isActive && "text-primary"
          )
        }
        aria-label={item.label}
      >
        <Icon className="size-5" />
        <span className="text-[11px]">{item.label}</span>
      </NavLink>
    );
  })}

  {/* Plus — always col 3 */}
  <ShadSheet>
    <SheetTrigger asChild>
      <Button
        size="icon"
        className="mx-auto size-12 rounded-full shadow-lg"
        aria-label="Quick actions"
      >
        <Plus className="size-5" />
      </Button>
    </SheetTrigger>
    <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <SheetHeader>
        <SheetTitle>Quick actions</SheetTitle>
        <SheetDescription>Start a new transaction or add supporting data.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-2 px-4 pb-4">
        {orderedActions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <SheetClose key={action.id} asChild>
              <Button asChild variant="ghost" className="justify-center gap-3 border border-muted">
                <Link to={action.to}>
                  <ActionIcon className="size-4" />
                  {action.label}
                </Link>
              </Button>
            </SheetClose>
          );
        })}
      </div>
    </SheetContent>
  </ShadSheet>

  {/* Right 2 nav items */}
  {mainNav.slice(2, 4).map((id) => {
    const item = NAV_ITEM_REGISTRY[id];
    const Icon = item.icon;
    return (
      <NavLink
        key={id}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
            isActive && "text-primary"
          )
        }
        aria-label={item.label}
      >
        <Icon className="size-5" />
        <span className="text-[11px]">{item.label}</span>
      </NavLink>
    );
  })}
</div>
```

> **Note:** Remove the first version of the grid and replace entirely with this split version.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Verify tests still pass**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileFooterNav.tsx
git commit -m "feat: rewrite MobileFooterNav with react-modal-sheet, collapsed nav + expanded pool"
```

---

## Task 6: Add Edit Mode + DnD

**Files:**
- Modify: `src/components/layout/MobileFooterNav.tsx`

This task adds the Edit button, minus badges, DnD reordering within the main nav, and tap/drag to add from pool.

- [ ] **Step 1: Add imports for @dnd-kit**

At the top of `src/components/layout/MobileFooterNav.tsx`, add to the existing imports:

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Minus, GripHorizontal } from "lucide-react";
import type { NavItemId } from "@/hooks/use-nav-config";
```

- [ ] **Step 2: Add `SortableNavItem` component**

Add this component inside `MobileFooterNav.tsx`, before the `MobileFooterNav` function:

```tsx
function SortableNavItem({
  id,
  isEditMode,
  onRemove,
}: {
  id: NavItemId;
  isEditMode: boolean;
  onRemove: (id: NavItemId) => void;
}) {
  const item = NAV_ITEM_REGISTRY[id];
  const Icon = item.icon;
  const location = useLocation();
  const isActive = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col items-center justify-center"
    >
      {isEditMode && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(id)}
          className="absolute -top-1 -left-1 z-10 size-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
          aria-label={`Remove ${item.label}`}
        >
          <Minus className="size-2.5" />
        </button>
      )}
      <div
        {...(isEditMode ? { ...attributes, ...listeners } : {})}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors cursor-default",
          isEditMode ? "cursor-grab active:cursor-grabbing" : "",
          isActive && !isEditMode ? "text-primary" : "text-muted-foreground"
        )}
      >
        {isEditMode && <GripHorizontal className="size-3 text-muted-foreground/50 mb-0.5" />}
        <Icon className="size-5" />
        <span className="text-[11px]">{item.label}</span>
      </div>
    </div>
  );
}
```

> **Note:** In edit mode, `SortableNavItem` is not wrapped in a NavLink — it's not navigable. In non-edit mode, navigation is handled separately (see Step 3).

- [ ] **Step 3: Add `PoolItem` component**

Add this component after `SortableNavItem`:

```tsx
function PoolItem({
  id,
  isEditMode,
  canAdd,
  onAdd,
}: {
  id: NavItemId;
  isEditMode: boolean;
  canAdd: boolean;
  onAdd: (id: NavItemId) => void;
}) {
  const item = NAV_ITEM_REGISTRY[id];
  const Icon = item.icon;
  const location = useLocation();
  const isActive = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  if (!isEditMode) {
    return (
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive: active }) =>
          cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs text-muted-foreground transition-colors",
            active && "text-primary bg-primary/5"
          )
        }
        aria-label={item.label}
      >
        <Icon className="size-5" />
        <span className="text-[11px]">{item.label}</span>
      </NavLink>
    );
  }

  return (
    <button
      onClick={() => canAdd && onAdd(id)}
      disabled={!canAdd}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs transition-colors relative",
        canAdd
          ? "text-foreground hover:bg-muted cursor-pointer"
          : "text-muted-foreground/40 cursor-not-allowed",
        isActive && "text-primary"
      )}
      aria-label={canAdd ? `Add ${item.label} to main nav` : `Remove one item first`}
      title={!canAdd ? "Remove one item first" : undefined}
    >
      <Icon className="size-5" />
      <span className="text-[11px]">{item.label}</span>
      {canAdd && (
        <span className="absolute top-1 right-1 size-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Plus className="size-2" />
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Add edit mode state and DnD handlers to `MobileFooterNav`**

Inside the `MobileFooterNav` function, after the `useNavConfig` destructure, add:

```tsx
const [isEditMode, setIsEditMode] = useState(false);
const [activeId, setActiveId] = useState<NavItemId | null>(null);

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
);

function handleDragStart({ active }: DragStartEvent) {
  setActiveId(active.id as NavItemId);
}

function handleDragEnd({ active, over }: DragEndEvent) {
  setActiveId(null);
  if (!over || active.id === over.id) return;
  const oldIndex = mainNav.indexOf(active.id as NavItemId);
  const newIndex = mainNav.indexOf(over.id as NavItemId);
  if (oldIndex !== -1 && newIndex !== -1) {
    setMainNav(arrayMove(mainNav, oldIndex, newIndex));
  }
}

function handleRemove(id: NavItemId) {
  setMainNav(mainNav.filter((item) => item !== id));
}

function handleAdd(id: NavItemId) {
  if (mainNav.length >= 4) return;
  setMainNav([...mainNav, id]);
}

const canAdd = mainNav.length < 4;
```

Also update the `useEffect` that closes on navigation to also exit edit mode:

```tsx
useEffect(() => {
  sheetRef.current?.snapTo(1);
  setIsEditMode(false);
}, [location.pathname]);
```

- [ ] **Step 5: Replace the main nav row with the DnD-enabled version**

Replace the `{/* Main nav row */}` section (the entire `<div className="grid grid-cols-5 ...">`) with:

```tsx
{/* Main nav row */}
<div className="flex items-center justify-between px-2 pt-1">
  {isExpanded && (
    <div className="w-12" /> // spacer to balance the edit button
  )}
  {isExpanded && (
    <button
      onClick={() => setIsEditMode((v) => !v)}
      className="text-xs font-medium text-primary px-2 py-1"
    >
      {isEditMode ? "Done" : "Edit"}
    </button>
  )}
</div>

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext items={mainNav} strategy={horizontalListSortingStrategy}>
    <div className="grid grid-cols-5 items-center gap-1 px-2 pb-2">
      {/* Left 2 nav items */}
      {mainNav.slice(0, 2).map((id) =>
        isEditMode ? (
          <SortableNavItem
            key={id}
            id={id}
            isEditMode={isEditMode}
            onRemove={handleRemove}
          />
        ) : (
          (() => {
            const item = NAV_ITEM_REGISTRY[id];
            const Icon = item.icon;
            return (
              <NavLink
                key={id}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
                    isActive && "text-primary"
                  )
                }
                aria-label={item.label}
              >
                <Icon className="size-5" />
                <span className="text-[11px]">{item.label}</span>
              </NavLink>
            );
          })()
        )
      )}

      {/* Plus — always col 3 */}
      <ShadSheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="mx-auto size-12 rounded-full shadow-lg"
            aria-label="Quick actions"
            disabled={isEditMode}
          >
            <Plus className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>Quick actions</SheetTitle>
            <SheetDescription>Start a new transaction or add supporting data.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-4">
            {orderedActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <SheetClose key={action.id} asChild>
                  <Button asChild variant="ghost" className="justify-center gap-3 border border-muted">
                    <Link to={action.to}>
                      <ActionIcon className="size-4" />
                      {action.label}
                    </Link>
                  </Button>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </ShadSheet>

      {/* Right 2 nav items */}
      {mainNav.slice(2, 4).map((id) =>
        isEditMode ? (
          <SortableNavItem
            key={id}
            id={id}
            isEditMode={isEditMode}
            onRemove={handleRemove}
          />
        ) : (
          (() => {
            const item = NAV_ITEM_REGISTRY[id];
            const Icon = item.icon;
            return (
              <NavLink
                key={id}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
                    isActive && "text-primary"
                  )
                }
                aria-label={item.label}
              >
                <Icon className="size-5" />
                <span className="text-[11px]">{item.label}</span>
              </NavLink>
            );
          })()
        )
      )}
    </div>
  </SortableContext>
</DndContext>
```

- [ ] **Step 6: Replace the pool grid with `PoolItem` components**

Replace the `{/* Pool grid */}` section inside the `{isExpanded && ...}` block:

```tsx
{pool.length > 0 && (
  <div className="px-4 pb-2">
    <div className="grid grid-cols-4 gap-1">
      {pool.map((id) => (
        <PoolItem
          key={id}
          id={id}
          isEditMode={isEditMode}
          canAdd={canAdd}
          onAdd={handleAdd}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 7: Add Edit button row above the main nav (inside Sheet.Content, before DndContext)**

Replace the `{/* Main nav row */}` header div with:

```tsx
{isExpanded && (
  <div className="flex items-center justify-end px-4 pt-2 pb-0">
    <button
      onClick={() => setIsEditMode((v) => !v)}
      className="text-xs font-medium text-primary px-1 py-0.5"
    >
      {isEditMode ? "Done" : "Edit"}
    </button>
  </div>
)}
```

> Remove the spacer div from Step 5 — it's now a clean single edit button row.

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 9: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/MobileFooterNav.tsx
git commit -m "feat: add edit mode and DnD to MobileFooterNav (reorder, add/remove nav items)"
```

---

## Task 7: Update AppLayout Bottom Padding

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

The sheet's collapsed height is `76px`. Update the main content bottom padding to avoid content being hidden behind the nav.

- [ ] **Step 1: Update padding in AppLayout**

In `src/components/layout/AppLayout.tsx`, change:

```tsx
showFooter && "pb-28",
```

to:

```tsx
showFooter && "pb-24",
```

> 76px collapsed height + safe area. `pb-24` = 96px — gives enough clearance.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "fix: update AppLayout bottom padding for new nav collapsed height"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ react-modal-sheet snap between collapsed/expanded — Task 5
- ✅ Main nav: 4 items + fixed Plus — Tasks 5, 6
- ✅ Edit button top-right when expanded — Task 6 Step 7
- ✅ Minus badge to remove from main nav — Task 6 Step 2
- ✅ DnD reorder within main nav — Task 6 Steps 1–5
- ✅ Pool items: tap to add — Task 6 Step 3
- ✅ Disabled pool items when main nav full — Task 6 Step 3 (`canAdd`)
- ✅ Pool items are NavLinks in non-edit mode — Task 6 Step 3
- ✅ Flat 4-col pool grid — Tasks 5, 6
- ✅ Sync + install footer — Task 5 (`SyncFooter`)
- ✅ localStorage first, settings debounced — Task 3
- ✅ Settings field `mobile_nav_config` — Task 2
- ✅ FolderSection extracted, unused — Task 4
- ✅ Keyboard hide — preserved in Task 5
- ✅ AppLayout padding — Task 7
- ✅ Quick-actions Plus sheet unchanged — Tasks 5, 6

**Not implemented (out of scope):**
- Drag from pool into main nav row (drag-to-add cross-container) — only tap-to-add is implemented. Full cross-container drag requires additional `useDroppable` zones on the main nav row and hit-testing logic; can be added as a follow-up.

> **Note to implementer:** The spec mentioned drag-from-pool as an option alongside tap. This plan implements tap-to-add only. Cross-container drag is architecturally compatible (same `DndContext`) but adds significant complexity. Verify with user if drag-to-add from pool is required before implementing.
