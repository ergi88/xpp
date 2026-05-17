# Transactions Overhaul — Phase 5: Recurring Engine + Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate transactions automatically when recurring templates come due, stamp `recurring_id` on each generated transaction, and let users create a recurring template from any transaction. Surface the bi-directional link in both view pages.

**Architecture:** Pure date-math helper `advanceNextRunDate(frequency, interval, current, dayOfWeek?, dayOfMonth?)` is the testable unit. The engine `runDueRecurring()` scans active recurring rows where `next_run_date <= today`, creates a transaction with `recurring_id` set, then advances `next_run_date` on the recurring row. Two triggers: app-load (run-once on auth bootstrap) + per-template "Run now" button. "Create recurring from this" navigates to the existing recurring/create page with a `?from_transaction=<id>` query param the page reads to prefill the form, and stores `created_from_transaction_id` on the created template.

**Tech Stack:** React 19, TypeScript, vite, @tanstack/react-query, react-router-dom v6, vitest.

**Source spec:** [`docs/superpowers/specs/2026-05-11-transactions-debts-recurring-overhaul-design.md`](../specs/2026-05-11-transactions-debts-recurring-overhaul-design.md), §3.2, §4.5, §5.3, §6.5.

**Phase 1–4 status:** Complete. `Transaction.recurringId` field exists (Phase 1), `toRecurring` reads `last_run_date` (already populated). View page connections panel shows "↻ From recurring" chip when `recurringId` is set (Phase 1 placeholder — Phase 5 wires the real source navigation).

**Commit discipline:** Each task ends with a commit. Conventional `feat:` / `refactor:` / `test:`. Trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## File structure (Phase 5)

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/recurring-schedule.ts` | `advanceNextRunDate(...)` pure date math |
| Create | `src/lib/__tests__/recurring-schedule.test.ts` | Unit tests for the schedule helper |
| Modify | `src/types/recurring.ts` | Add `createdFromTransactionId?` field on `RecurringTransaction` |
| Modify | `src/api/recurring.ts` | Read/write `created_from_transaction_id`, `last_run_date`; add `runDueRecurring()` + `runNow(id)` methods |
| Modify | `src/hooks/use-recurring.ts` | Add `useRunDueRecurring`, `useRunNowRecurring` mutation hooks |
| Modify | `src/auth/setup/steps/ConnectStep.tsx` OR app shell | Call `runDueRecurring` once on auth bootstrap |
| Modify | `src/app/App.tsx` | Run-once-on-mount effect calling `useRunDueRecurring` (less invasive than auth flow) |
| Modify | `src/pages/recurring/[id]/edit.tsx` | "Run now" button + Generated transactions list (filter by `recurring_id`) |
| Modify | `src/pages/recurring/create.tsx` | Read `?from_transaction=<id>` param, prefill form, send `created_from_transaction_id` |
| Modify | `src/pages/transactions/[id]/index.tsx` | "Create recurring from this" action button; "From recurring" connection chip points at recurring edit page |

---

## Task 1: TDD `advanceNextRunDate`

**Files:**
- Create: `src/lib/recurring-schedule.ts`
- Create: `src/lib/__tests__/recurring-schedule.test.ts`

Pure date helper. Given a current `next_run_date` (YYYY-MM-DD) + frequency/interval/optional day-of-week/day-of-month, returns the next occurrence after it.

Rules:
- `daily`: add `interval` days
- `weekly`: add `interval * 7` days, then clamp to `day_of_week` if provided (0=Sun…6=Sat)
- `monthly`: add `interval` months, then clamp to `day_of_month` (1–31, shorter months use last day of month)
- `yearly`: add `interval` years, preserving month/day; if 02-29 + non-leap → 02-28

### Step 1: Write failing tests

Create `src/lib/__tests__/recurring-schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { advanceNextRunDate } from '@/lib/recurring-schedule'

describe('advanceNextRunDate', () => {
  it('daily: adds interval days', () => {
    expect(advanceNextRunDate('2026-05-10', 'daily', 1)).toBe('2026-05-11')
    expect(advanceNextRunDate('2026-05-10', 'daily', 3)).toBe('2026-05-13')
  })
  it('weekly with no day_of_week: adds interval*7 days', () => {
    expect(advanceNextRunDate('2026-05-10', 'weekly', 1)).toBe('2026-05-17')
    expect(advanceNextRunDate('2026-05-10', 'weekly', 2)).toBe('2026-05-24')
  })
  it('weekly with day_of_week clamps to next matching weekday', () => {
    // 2026-05-10 is a Sunday (day 0). +7 = 2026-05-17 (Sun). Clamp to Wed (3) → 2026-05-20.
    expect(advanceNextRunDate('2026-05-10', 'weekly', 1, 3)).toBe('2026-05-20')
  })
  it('monthly: adds interval months preserving day_of_month', () => {
    expect(advanceNextRunDate('2026-05-15', 'monthly', 1, undefined, 15)).toBe('2026-06-15')
    expect(advanceNextRunDate('2026-05-15', 'monthly', 2, undefined, 15)).toBe('2026-07-15')
  })
  it('monthly: clamps day_of_month=31 to last day of shorter months', () => {
    // 2026-01-31 + 1 month = clamp to 02-28
    expect(advanceNextRunDate('2026-01-31', 'monthly', 1, undefined, 31)).toBe('2026-02-28')
    // 2024-01-31 + 1 month (2024 is leap) = clamp to 02-29
    expect(advanceNextRunDate('2024-01-31', 'monthly', 1, undefined, 31)).toBe('2024-02-29')
  })
  it('yearly: adds interval years preserving month/day', () => {
    expect(advanceNextRunDate('2026-05-15', 'yearly', 1)).toBe('2027-05-15')
    expect(advanceNextRunDate('2026-05-15', 'yearly', 3)).toBe('2029-05-15')
  })
  it('yearly: 02-29 + 1 non-leap year → 02-28', () => {
    expect(advanceNextRunDate('2024-02-29', 'yearly', 1)).toBe('2025-02-28')
  })
})
```

### Step 2: Run, expect failure

Run: `npm test -- src/lib/__tests__/recurring-schedule.test.ts`
Expected: FAIL — "Cannot find module '@/lib/recurring-schedule'".

### Step 3: Implement

Create `src/lib/recurring-schedule.ts`:

```ts
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate()
}

export function advanceNextRunDate(
  current: string,
  frequency: RecurringFrequency,
  interval: number,
  dayOfWeek?: number,
  dayOfMonth?: number,
): string {
  const [y, m, d] = current.split('-').map(Number)
  const base = new Date(y, m - 1, d)

  if (frequency === 'daily') {
    base.setDate(base.getDate() + interval)
    return fmt(base)
  }

  if (frequency === 'weekly') {
    base.setDate(base.getDate() + 7 * interval)
    if (typeof dayOfWeek === 'number') {
      const currentDow = base.getDay()
      const delta = (dayOfWeek - currentDow + 7) % 7
      base.setDate(base.getDate() + delta)
    }
    return fmt(base)
  }

  if (frequency === 'monthly') {
    const target = base.getMonth() + interval
    const newYear = base.getFullYear() + Math.floor(target / 12)
    const newMonth = ((target % 12) + 12) % 12
    const desiredDay = dayOfMonth ?? base.getDate()
    const clampedDay = Math.min(desiredDay, lastDayOfMonth(newYear, newMonth))
    return fmt(new Date(newYear, newMonth, clampedDay))
  }

  if (frequency === 'yearly') {
    const newYear = base.getFullYear() + interval
    const newMonth = base.getMonth()
    const desiredDay = base.getDate()
    const clampedDay = Math.min(desiredDay, lastDayOfMonth(newYear, newMonth))
    return fmt(new Date(newYear, newMonth, clampedDay))
  }

  throw new Error(`Unsupported frequency: ${frequency}`)
}
```

### Step 4: Run, expect pass

Run: `npm test -- src/lib/__tests__/recurring-schedule.test.ts`
Expected: 7 passing.

Full suite: `npm test`
Expected: 38 passing (31 existing + 7 new).

### Step 5: Commit

```bash
git add src/lib/recurring-schedule.ts src/lib/__tests__/recurring-schedule.test.ts
git commit -m "$(cat <<'EOF'
feat: add advanceNextRunDate schedule helper

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `createdFromTransactionId` to `RecurringTransaction` type + `dayOfWeek`/`dayOfMonth` reads

**Files:**
- Modify: `src/types/recurring.ts`
- Modify: `src/api/recurring.ts`

Current type already has `dayOfWeek?`/`dayOfMonth?` but `toRecurring` doesn't read them. Engine needs them.

### Step 1: Confirm type already has fields

Read `src/types/recurring.ts`. The `RecurringTransaction` interface should already have `dayOfWeek?: number` and `dayOfMonth?: number` (per `RecurringForm`). If not, add them.

Add the new field at the end of the interface body:

```ts
    createdFromTransactionId?: string
```

### Step 2: Update `toRecurring` to read the columns

Open `src/api/recurring.ts`. In `toRecurring`, add these fields to the returned object (alongside existing ones — match style):

```ts
    dayOfWeek: r.day_of_week !== undefined && r.day_of_week !== '' ? Number(r.day_of_week) : undefined,
    dayOfMonth: r.day_of_month !== undefined && r.day_of_month !== '' ? Number(r.day_of_month) : undefined,
    createdFromTransactionId: r.created_from_transaction_id ? String(r.created_from_transaction_id) : undefined,
```

### Step 3: Update `create` to persist `created_from_transaction_id` and `day_of_week`/`day_of_month`

In `recurringApi.create`, extend the row payload. Find the `await adapter.create('recurring', {...})` and add:

```ts
      day_of_week: data.day_of_week ?? '',
      day_of_month: data.day_of_month ?? '',
      created_from_transaction_id: (data as RecurringFormData & { created_from_transaction_id?: string }).created_from_transaction_id ?? '',
      last_run_date: '',
```

(The cast is needed because `RecurringFormData` schema may not declare the field — Task 4 fixes the schema.)

### Step 4: Build + tests

Run: `npm run build`
Expected: clean. (Schema may flag the cast — that's expected until Task 4.)

Run: `npm test`
Expected: 38 passing.

### Step 5: Commit

```bash
git add src/types/recurring.ts src/api/recurring.ts
git commit -m "$(cat <<'EOF'
feat: read and persist recurring schedule fields and createdFromTransactionId

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `created_from_transaction_id` to `recurringSchema`

**Files:**
- Modify: `src/schemas/recurring.ts`

### Step 1: Add field to schema

Open `src/schemas/recurring.ts`. In the `recurringSchema = z.object({...})` body, alongside the other fields, add:

```ts
    created_from_transaction_id: z.string().min(1).nullable().optional(),
```

### Step 2: Build

Run: `npm run build`
Expected: clean — the cast in Task 2 should no longer be needed, but leaving it doesn't hurt.

### Step 3: Commit

```bash
git add src/schemas/recurring.ts
git commit -m "$(cat <<'EOF'
feat: add created_from_transaction_id to recurringSchema

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `runDueRecurring()` + `runNow(id)` to `recurringApi`

**Files:**
- Modify: `src/api/recurring.ts`

The engine. Scans active recurring rows where `next_run_date <= today`, creates a transaction for each via `transactionsApi.create` with `recurring_id` set, then advances `next_run_date` on the recurring row using `advanceNextRunDate`. Idempotent — advancing the date is the lock.

`runNow(id)` forces a single template to run regardless of its `next_run_date`.

### Step 1: Add imports

At the top of `src/api/recurring.ts`:

```ts
import { transactionsApi } from './transactions'
import { advanceNextRunDate } from '@/lib/recurring-schedule'
```

### Step 2: Add helper for one row

Add a private helper before `recurringApi`:

```ts
async function runOne(r: RecurringTransaction): Promise<void> {
  // Create the generated transaction with recurring_id set.
  await transactionsApi.create({
    type: r.type as 'income' | 'expense' | 'transfer',
    account_id: r.accountId,
    to_account_id: r.toAccountId ?? null,
    category_id: r.categoryId ?? null,
    amount: r.amount,
    to_amount: r.toAmount ?? null,
    description: r.description ?? '',
    date: r.nextRunDate,
    tag_ids: r.tags.map(t => t.id),
    recurring_id: r.id,
  })

  // Advance the schedule and stamp last_run_date.
  const next = advanceNextRunDate(
    r.nextRunDate,
    r.frequency,
    r.interval,
    r.dayOfWeek,
    r.dayOfMonth,
  )
  // If next > endDate, deactivate.
  const shouldDeactivate = r.endDate ? next > r.endDate : false
  await adapter.update('recurring', r.id, {
    next_run_date: next,
    last_run_date: r.nextRunDate,
    is_active: shouldDeactivate ? 'false' : 'true',
  })
}
```

### Step 3: Add `runDueRecurring`

Inside `recurringApi`, after `getUpcoming`:

```ts
  runDueRecurring: async (): Promise<number> => {
    const all = await recurringApi.getAll()
    const today = new Date().toISOString().slice(0, 10)
    const due = all.filter(r => r.isActive && r.nextRunDate <= today)
    let count = 0
    for (const r of due) {
      // Loop in case multiple periods are due (e.g., template missed several runs).
      let current = r
      while (current.isActive && current.nextRunDate <= today) {
        await runOne(current)
        count++
        // Re-fetch to get the freshly advanced row.
        current = await recurringApi.getById(current.id)
      }
    }
    return count
  },

  runNow: async (id: string | number): Promise<RecurringTransaction> => {
    const r = await recurringApi.getById(id)
    await runOne(r)
    return recurringApi.getById(id)
  },
```

### Step 4: Build + tests

Run: `npm run build`
Expected: clean. If `transactionsApi.create` rejects the new `recurring_id` field on the payload, ensure `transactionsApi.create` accepts it. Phase 1 made the column write-through; verify by reading `src/api/transactions.ts` `create` method — should include `recurring_id: data.recurring_id ? String(data.recurring_id) : ''`. If absent, it's already there from Phase 1 work.

Run: `npm test`
Expected: 38 passing.

### Step 5: Commit

```bash
git add src/api/recurring.ts
git commit -m "$(cat <<'EOF'
feat: add runDueRecurring and runNow engine to recurringApi

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Engine triggers — app-load + manual mutation hooks

**Files:**
- Modify: `src/hooks/use-recurring.ts`
- Modify: `src/app/App.tsx` (or wherever the app shell mounts after auth)

### Step 1: Add hooks

Open `src/hooks/use-recurring.ts`. Append at the end:

```ts
export function useRunDueRecurring() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => recurringApi.runDueRecurring(),
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            if (count > 0) toast.success(`${count} recurring transaction${count === 1 ? '' : 's'} generated`)
        },
    })
}

export function useRunNowRecurring() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => recurringApi.runNow(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Recurring transaction generated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to run recurring')
        },
    })
}
```

Confirm `QUERY_KEY`, `recurringApi`, `useMutation`, `useQueryClient`, `toast` already imported in the file (used by sibling hooks).

### Step 2: Wire the app-load trigger

Open `src/app/App.tsx`. Find the top-level component that wraps the router. Add a one-shot effect that runs `runDueRecurring` on mount when the user is authenticated.

Look for where auth state is checked. If `App.tsx` does not handle auth-gated mounting, place the effect inside `src/components/layout/AppLayout.tsx` instead (which is rendered only for authenticated routes). Use `grep -n "AppLayout\|RouterProvider\|isAuthenticated" src/app/App.tsx src/components/layout/AppLayout.tsx` to confirm.

Inside whichever component wraps the authenticated app shell, add:

```tsx
import { useEffect, useRef } from 'react'
import { useRunDueRecurring } from '@/hooks'

// inside the component body, near other hooks:
const runDue = useRunDueRecurring()
const didRunRef = useRef(false)
useEffect(() => {
  if (didRunRef.current) return
  didRunRef.current = true
  runDue.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

The `useRef` guard ensures it runs at most once per page load (React 18 StrictMode would otherwise double-fire in dev).

### Step 3: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 38 passing.

### Step 4: Commit

```bash
git add src/hooks/use-recurring.ts src/app/App.tsx src/components/layout/AppLayout.tsx
git commit -m "$(cat <<'EOF'
feat: add useRunDueRecurring + useRunNowRecurring; trigger on app load

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Stage only the files you actually touched.

---

## Task 6: "Run now" button on recurring edit page

**Files:**
- Modify: `src/pages/recurring/[id]/edit.tsx`

### Step 1: Add the button + hook

Open `src/pages/recurring/[id]/edit.tsx`. Read the current structure first to find the right placement (near the form's footer or the existing action buttons).

Add imports:

```tsx
import { Play } from 'lucide-react'
import { useRunNowRecurring } from '@/hooks'
import { Button } from '@/components/ui/button'
```

Inside the component:

```tsx
  const runNow = useRunNowRecurring()
```

Near the existing form-action area (e.g., right above or beside the Save button), add:

```tsx
        <Button
          type="button"
          variant="outline"
          onClick={() => runNow.mutate(id!)}
          disabled={runNow.isPending}
        >
          <Play className="size-4 mr-1" />
          {runNow.isPending ? 'Running...' : 'Run now'}
        </Button>
```

(`id` is the URL param — already destructured via `useParams` in the file. If not, follow the file's convention.)

### Step 2: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 38 passing.

### Step 3: Commit

```bash
git add src/pages/recurring/\[id\]/edit.tsx
git commit -m "$(cat <<'EOF'
feat: add Run now button to recurring edit page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: "Generated transactions" section on recurring edit page

**Files:**
- Modify: `src/pages/recurring/[id]/edit.tsx`

Show the list of transactions generated by this recurring template (filter `transactions` by `recurringId === id`).

### Step 1: Fetch + filter

Inside the recurring edit page component, add:

```tsx
import { useTransactions } from '@/hooks'

// inside component body:
const { data: txnsResp } = useTransactions({
  per_page: 9999,
  include_excluded: true,
  include_split_children: false,
})
const generated = (txnsResp?.data ?? []).filter((t) => t.recurringId === id)
```

### Step 2: Render below the form

At the bottom of the page JSX (after the form), add a section:

```tsx
<div className="mt-6 space-y-2">
  <h3 className="font-medium">Generated transactions ({generated.length})</h3>
  {generated.length === 0 ? (
    <p className="text-sm text-muted-foreground">No transactions yet.</p>
  ) : (
    <ul className="border rounded-lg divide-y">
      {generated.map((t) => (
        <li key={t.id}>
          <Link
            to={`/transactions/${t.id}`}
            className="block p-3 hover:bg-muted transition-colors flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {t.description || <span className="italic text-muted-foreground">No description</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.date).toLocaleDateString()}
              </div>
            </div>
            <div className="font-mono tabular-nums">
              <AmountText
                value={t.amount}
                decimals={t.account.currency?.decimals ?? 2}
                currency={t.account.currency?.symbol}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )}
</div>
```

Add `import { Link } from 'react-router-dom'` and `import { AmountText } from '@/components/shared/AmountText'` at the top if not already present.

### Step 3: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 38 passing.

### Step 4: Commit

```bash
git add src/pages/recurring/\[id\]/edit.tsx
git commit -m "$(cat <<'EOF'
feat: list generated transactions on recurring edit page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: "Create recurring from this" on transaction view page

**Files:**
- Modify: `src/pages/transactions/[id]/index.tsx`

### Step 1: Add button to action bar

Open `src/pages/transactions/[id]/index.tsx`. Add to lucide-react import: `Repeat`.

In the action bar (between Edit/Duplicate and Delete), add:

```tsx
{!t.parentId && (
  <Button asChild variant="outline">
    <Link to={`/recurring/create?from_transaction=${t.id}`}>
      <Repeat className="size-4 mr-1" />
      Create recurring
    </Link>
  </Button>
)}
```

### Step 2: Update the "From recurring" chip in Connections panel

Find the existing chip that reads:

```tsx
{t.recurringId && (
  <Link to={`/recurring/${t.recurringId}/edit`} className="block hover:underline">
    ↻ From recurring template →
  </Link>
)}
```

Already correct from Phase 1. No change.

### Step 3: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 38 passing.

### Step 4: Commit

```bash
git add src/pages/transactions/\[id\]/index.tsx
git commit -m "$(cat <<'EOF'
feat: add Create recurring action on transaction view page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Recurring create page reads `from_transaction` query param

**Files:**
- Modify: `src/pages/recurring/create.tsx`

### Step 1: Read source transaction + prefill

Open `src/pages/recurring/create.tsx`. Read current structure. Add:

```tsx
import { useSearchParams } from 'react-router-dom'
import { useTransaction } from '@/hooks'

// inside component:
const [searchParams] = useSearchParams()
const fromTransactionId = searchParams.get('from_transaction')
const { data: source } = useTransaction(fromTransactionId ?? '')

const defaultValues = source
  ? {
      type: source.type,
      account_id: source.account.id,
      to_account_id: source.toAccount?.id ?? null,
      category_id: source.category?.id ?? null,
      amount: source.amount,
      to_amount: source.toAmount ?? null,
      description: source.description ?? '',
      frequency: 'monthly' as const,
      interval: 1,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: null,
      is_active: true,
      tag_ids: source.tags.map((t) => t.id),
      created_from_transaction_id: source.id,
    }
  : undefined
```

Pass `defaultValues` to the `<RecurringForm />`. If the existing page doesn't accept `defaultValues`, mirror the pattern from `src/pages/transactions/[id]/edit.tsx` for how form data is plumbed.

If `fromTransactionId` is empty, skip the prefill (page works as before).

If `source` is still loading, render a skeleton:

```tsx
if (fromTransactionId && !source) return <Page><div className="p-8">Loading...</div></Page>
```

### Step 2: Wire `created_from_transaction_id` through submit

`recurringApi.create` already persists the field (Task 2). Confirm `RecurringForm.onSubmit` propagates the entire form data — it does via `react-hook-form`, which includes the new field (added in Task 3 schema).

### Step 3: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 38 passing.

### Step 4: Commit

```bash
git add src/pages/recurring/create.tsx
git commit -m "$(cat <<'EOF'
feat: prefill recurring create form from ?from_transaction= param

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final verification

- [ ] **Step 1: Type-check + build**

Run: `npm run build`
Expected: clean exit.

- [ ] **Step 2: Tests**

Run: `npm test`
Expected: 38 passing.

- [ ] **Step 3: Manual smoke**

```
1. Visit /recurring/create. Fill: type=expense, amount=10, frequency=daily,
   interval=1, start_date=yesterday. Save. The recurring template appears.
2. Refresh app. App-load runs `runDueRecurring`. Yesterday's transaction
   appears in /transactions tagged with ↻ icon. Recurring's next_run_date
   advanced one day.
3. Open the generated transaction view → "From recurring" chip links to the
   template's edit page.
4. On the template page, click "Run now" → another transaction generated for
   today (or whatever next_run_date is). next_run_date advanced.
5. On the template page, scroll to "Generated transactions" → both rows listed.
6. On any standalone transaction view, click "Create recurring" → recurring
   create page opens prefilled with that transaction's data. Save. Verify
   the new recurring template has created_from_transaction_id set in the
   sheet.
7. Edge cases:
   - Recurring with end_date in the past + next_run_date overdue: engine
     deactivates after first run (is_active flips false).
   - Yearly template on 02-29: advances to 02-28 in non-leap years.
   - Multiple missed runs: engine catches up by looping (re-fetching after
     each run).
8. GAS deploy: if columns day_of_week, day_of_month, last_run_date,
   created_from_transaction_id don't exist in recurring sheet, ensureColumns
   adds them on first write. Verify by checking sheet headers after Step 1.
```

If any step fails, do NOT mark Phase 5 complete.

- [ ] **Step 4: Tag**

```bash
git tag phase-5-recurring-engine
```

---

## Wrap-up

After Phase 5 ships, every section of the spec is implemented:
- §3 schema additions ✓
- §4 domain rules (exclude / one-time, splits, links, debt, recurring) ✓
- §5 architecture (effects, filters, engine, view page, list) ✓
- §6 UI details (toggles, split editor, link picker, debt picker, recurring create) ✓
- §7 reports/budgets/dashboard application ✓
- §8 items unification ✓
- §9 form/schema changes ✓

Remaining work outside this overhaul:
- The recurring-detection guard mentioned in `src/api/recurring.ts:1-3` is still a TODO — there's no detection feature yet, just the comment. Pure runway, not Phase 5 scope.
