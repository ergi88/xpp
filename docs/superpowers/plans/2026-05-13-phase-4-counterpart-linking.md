# Transactions Overhaul — Phase 4: Counterpart Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users link two existing standalone transactions as a reconciled transfer counterpart (e.g. an expense on Account A + an income on Account B → mark as the same money movement). Linked pairs collapse to one row in aggregates so reports don't double-count.

**Architecture:** Storage already exists — `linked_transaction_id` column on `transactions` (Phase 1). Linking writes mutual ids on both rows; unlinking clears both. Side-effects on balances are unchanged (each row already mutated its own account when created). Reports / summary already call `collapseLinkedPairs` (Phase 1 helper, wired in Phase 2). What remains: API methods, hooks, candidate-picker modal, view-page wiring.

**Tech Stack:** React 19, TypeScript, vite, @tanstack/react-query, react-router-dom v6, vitest.

**Source spec:** [`docs/superpowers/specs/2026-05-11-transactions-debts-recurring-overhaul-design.md`](../specs/2026-05-11-transactions-debts-recurring-overhaul-design.md), §4.3, §6.3.

**Phase 1–3 status:** Complete. `collapseLinkedPairs` already runs in `transactionsApi.getAll` summary chain + `reports.ts` `loadAll` categoryView/trendView. Schema field + persistence wired since Phase 1. View page "Connections" panel already renders the linked-counterpart chip when set.

**Parent-level debt payment:** Shipped in Phase 3 fixes via the Category/Debt mode switch on TransactionForm. NOT in Phase 4 scope.

**Commit discipline:** Each task ends with a commit. Conventional `feat:` / `refactor:` / `test:`. Trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## File structure (Phase 4)

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/counterpart-matcher.ts` | `findCounterpartCandidates(source, all, options)` pure function |
| Create | `src/lib/__tests__/counterpart-matcher.test.ts` | Unit tests for the matcher |
| Modify | `src/api/transactions.ts` | Add `linkCounterpart(a, b)` and `unlinkCounterpart(id)` methods |
| Modify | `src/hooks/use-transactions.ts` | Add `useLinkCounterpart`, `useUnlinkCounterpart` mutation hooks |
| Create | `src/components/features/transactions/CounterpartLinkPicker.tsx` | Modal with candidate list, click-to-link |
| Modify | `src/pages/transactions/[id]/index.tsx` | "Link counterpart" button in action bar; "Unlink" action on existing chip |

---

## Task 1: TDD `findCounterpartCandidates`

**Files:**
- Create: `src/lib/counterpart-matcher.ts`
- Create: `src/lib/__tests__/counterpart-matcher.test.ts`

A pure function that, given a source transaction and a flat list of all transactions, returns candidates that could be its counterpart. Matching rules per spec §4.3:
- Opposite types (one income, one expense)
- Different `account.id`
- Date within ±7 days of source
- Amount equal within 0.01 (compare against the other side's `amount`, or `toAmount` if present)
- Not already linked
- Not already in a split (no `parentId`)
- Not the source itself

### Step 1: Write the failing tests

Create `src/lib/__tests__/counterpart-matcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import { findCounterpartCandidates } from '@/lib/counterpart-matcher'

function txn(o: Partial<Transaction> & { id: string }): Transaction {
  return {
    id: o.id,
    type: o.type ?? 'expense',
    amount: o.amount ?? 100,
    date: o.date ?? '2026-05-10',
    account: o.account ?? ({ id: 'a1' } as Transaction['account']),
    items: [],
    tags: [],
    isExcluded: false,
    isOneTime: false,
    parentId: null,
    debtId: null,
    linkedTransactionId: null,
    recurringId: null,
    ...o,
  } as Transaction
}

describe('findCounterpartCandidates', () => {
  it('returns rows of opposite type on different account, same amount, ±7 days', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, date: '2026-05-10', account: { id: 'a1' } as Transaction['account'] })
    const match = txn({ id: 'm', type: 'income', amount: 100, date: '2026-05-11', account: { id: 'a2' } as Transaction['account'] })
    const result = findCounterpartCandidates(source, [source, match])
    expect(result.map(t => t.id)).toEqual(['m'])
  })
  it('excludes same type', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const same = txn({ id: 'x', type: 'expense', amount: 100, account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, same])).toEqual([])
  })
  it('excludes same account', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const sameAcc = txn({ id: 'x', type: 'income', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, sameAcc])).toEqual([])
  })
  it('excludes outside ±7 days', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, date: '2026-05-01', account: { id: 'a1' } as Transaction['account'] })
    const far = txn({ id: 'x', type: 'income', amount: 100, date: '2026-05-20', account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, far])).toEqual([])
  })
  it('excludes amount mismatch outside 0.01', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const off = txn({ id: 'x', type: 'income', amount: 100.5, account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, off])).toEqual([])
  })
  it('excludes already-linked rows', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const linked = txn({ id: 'x', type: 'income', amount: 100, linkedTransactionId: 'other', account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, linked])).toEqual([])
  })
  it('excludes split children', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const child = txn({ id: 'x', type: 'income', amount: 100, parentId: 'p', account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, child])).toEqual([])
  })
  it('excludes the source itself', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source])).toEqual([])
  })
  it('returns multiple candidates sorted by closest date', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, date: '2026-05-10', account: { id: 'a1' } as Transaction['account'] })
    const day3 = txn({ id: 'm3', type: 'income', amount: 100, date: '2026-05-13', account: { id: 'a2' } as Transaction['account'] })
    const day1 = txn({ id: 'm1', type: 'income', amount: 100, date: '2026-05-11', account: { id: 'a2' } as Transaction['account'] })
    const result = findCounterpartCandidates(source, [source, day3, day1])
    expect(result.map(t => t.id)).toEqual(['m1', 'm3'])
  })
})
```

### Step 2: Run, expect failure

Run: `npm test -- src/lib/__tests__/counterpart-matcher.test.ts`
Expected: FAIL — "Cannot find module '@/lib/counterpart-matcher'".

### Step 3: Implement

Create `src/lib/counterpart-matcher.ts`:

```ts
import type { Transaction } from '@/types'

const DAY_MS = 86400000
const DEFAULT_WINDOW_DAYS = 7

export interface CounterpartMatchOptions {
  windowDays?: number
}

function daysApart(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(da - db) / DAY_MS
}

function amountMatches(source: Transaction, other: Transaction): boolean {
  if (Math.abs(source.amount - other.amount) <= 0.01) return true
  // FX: if either side has a toAmount, allow match against it too.
  if (source.toAmount != null && Math.abs(source.toAmount - other.amount) <= 0.01) return true
  if (other.toAmount != null && Math.abs(source.amount - other.toAmount) <= 0.01) return true
  return false
}

export function findCounterpartCandidates(
  source: Transaction,
  all: Transaction[],
  options: CounterpartMatchOptions = {},
): Transaction[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const result = all.filter(t => {
    if (t.id === source.id) return false
    if (t.parentId) return false
    if (t.linkedTransactionId) return false
    if (!t.account || !source.account) return false
    if (t.account.id === source.account.id) return false
    // Opposite types: income vs expense. Transfers excluded from linking.
    const oppositeTypes =
      (source.type === 'expense' && t.type === 'income') ||
      (source.type === 'income' && t.type === 'expense')
    if (!oppositeTypes) return false
    if (daysApart(source.date, t.date) > windowDays) return false
    if (!amountMatches(source, t)) return false
    return true
  })
  // Closest-date first.
  result.sort((a, b) => daysApart(source.date, a.date) - daysApart(source.date, b.date))
  return result
}
```

### Step 4: Run, expect pass

Run: `npm test -- src/lib/__tests__/counterpart-matcher.test.ts`
Expected: 9 passing.

Also full suite: `npm test`
Expected: 31 passing (22 from before + 9 new).

### Step 5: Commit

```bash
git add src/lib/counterpart-matcher.ts src/lib/__tests__/counterpart-matcher.test.ts
git commit -m "$(cat <<'EOF'
feat: add findCounterpartCandidates matcher with date/amount/account rules

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `linkCounterpart` and `unlinkCounterpart` API methods

**Files:**
- Modify: `src/api/transactions.ts`

Storage: write `linked_transaction_id` on both rows pointing at each other. Unlinking clears both. No balance side-effects (each row already mutated its account on creation).

### Step 1: Add the methods

Open `src/api/transactions.ts`. In the `transactionsApi` object, after `unsplit` (or near the bottom), add:

```ts
  linkCounterpart: async (idA: string | number, idB: string | number): Promise<void> => {
    const [a, b] = await Promise.all([
      transactionsApi.getById(idA),
      transactionsApi.getById(idB),
    ])
    if (a.linkedTransactionId) {
      throw new Error('Source transaction is already linked')
    }
    if (b.linkedTransactionId) {
      throw new Error('Target transaction is already linked')
    }
    await Promise.all([
      adapter.update('transactions', String(idA), { linked_transaction_id: String(idB) }),
      adapter.update('transactions', String(idB), { linked_transaction_id: String(idA) }),
    ])
  },

  unlinkCounterpart: async (id: string | number): Promise<void> => {
    const t = await transactionsApi.getById(id)
    if (!t.linkedTransactionId) return
    await Promise.all([
      adapter.update('transactions', String(id), { linked_transaction_id: '' }),
      adapter.update('transactions', String(t.linkedTransactionId), { linked_transaction_id: '' }),
    ])
  },
```

### Step 2: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 31 passing.

### Step 3: Commit

```bash
git add src/api/transactions.ts
git commit -m "$(cat <<'EOF'
feat: add transactionsApi.linkCounterpart and unlinkCounterpart

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add link / unlink mutation hooks

**Files:**
- Modify: `src/hooks/use-transactions.ts`

### Step 1: Append hooks

At the end of `src/hooks/use-transactions.ts`, after `useUnsplitTransaction`, append:

```ts
export function useLinkCounterpart() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (params: { idA: string | number; idB: string | number }) =>
            transactionsApi.linkCounterpart(params.idA, params.idB),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Counterpart linked')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to link counterpart')
        },
    })
}

export function useUnlinkCounterpart() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => transactionsApi.unlinkCounterpart(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Counterpart unlinked')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to unlink')
        },
    })
}
```

### Step 2: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 31 passing.

### Step 3: Commit

```bash
git add src/hooks/use-transactions.ts
git commit -m "$(cat <<'EOF'
feat: add useLinkCounterpart and useUnlinkCounterpart hooks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `CounterpartLinkPicker` modal

**Files:**
- Create: `src/components/features/transactions/CounterpartLinkPicker.tsx`

A dialog. Lists candidates via `findCounterpartCandidates`. Click a row → calls `onPick(targetId)` → caller fires mutation.

### Step 1: Create the file

```tsx
import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AmountText } from '@/components/shared/AmountText'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks'
import { findCounterpartCandidates } from '@/lib/counterpart-matcher'
import type { Transaction } from '@/types'

interface Props {
  source: Transaction
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (targetId: string) => void
  isSubmitting?: boolean
}

export function CounterpartLinkPicker({
  source,
  open,
  onOpenChange,
  onPick,
  isSubmitting,
}: Props) {
  // Pull a wide month-window around the source to catch ±7 days.
  const { data } = useTransactions({
    per_page: 9999,
    include_split_children: false,
    include_excluded: true,
  })

  const candidates = useMemo(() => {
    if (!data?.data) return []
    return findCounterpartCandidates(source, data.data)
  }, [data, source])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link counterpart</DialogTitle>
          <DialogDescription>
            Pick an opposite-type transaction on a different account, within
            ±7 days, with matching amount. Linking removes it from category /
            budget aggregates so the transfer is not double-counted.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No candidates found. The other side must be an opposite-type
            transaction on a different account within ±7 days, with the same
            amount, not already linked, and not a split child.
          </p>
        ) : (
          <ul className="divide-y border rounded-lg max-h-96 overflow-auto">
            {candidates.map((c) => {
              const Icon = c.type === 'income' ? ArrowDownLeft : ArrowUpRight
              const color = c.type === 'income' ? 'text-green-600' : 'text-red-600'
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c.id)}
                    disabled={isSubmitting}
                    className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <Icon className={cn('size-4 shrink-0', color)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {c.description || (
                          <span className="italic text-muted-foreground">
                            No description
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.date).toLocaleDateString()} ·{' '}
                        {c.account?.name}
                      </div>
                    </div>
                    <div className="font-mono font-medium tabular-nums">
                      <AmountText
                        value={c.amount}
                        decimals={c.account.currency?.decimals ?? 2}
                        currency={c.account.currency?.symbol}
                      />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 2: Build

Run: `npm run build`
Expected: clean.

### Step 3: Commit

```bash
git add src/components/features/transactions/CounterpartLinkPicker.tsx
git commit -m "$(cat <<'EOF'
feat: add CounterpartLinkPicker modal with candidate list

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire link/unlink into transaction view page

**Files:**
- Modify: `src/pages/transactions/[id]/index.tsx`

### Step 1: Add imports

At the top of `src/pages/transactions/[id]/index.tsx`, add to the existing imports:

```tsx
import { Link2, Link2Off } from 'lucide-react'
import { CounterpartLinkPicker } from '@/components/features/transactions/CounterpartLinkPicker'
import { useLinkCounterpart, useUnlinkCounterpart } from '@/hooks'
```

### Step 2: Add state + hooks inside component

After the existing mutation hooks:

```ts
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)
  const linkCounterpart = useLinkCounterpart()
  const unlinkCounterpart = useUnlinkCounterpart()
```

### Step 3: Update the connections-panel "Linked counterpart" row

Find the existing block that renders `↻`/`⇄`/`$` chips. Replace the `linkedTransactionId` row with one that includes an inline "Unlink" button:

```tsx
              {t.linkedTransactionId && (
                <div className="flex items-center gap-2">
                  <Link
                    to={`/transactions/${t.linkedTransactionId}`}
                    className="flex-1 hover:underline"
                  >
                    ⇄ Linked counterpart →
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unlinkCounterpart.mutate(t.id)}
                    disabled={unlinkCounterpart.isPending}
                  >
                    <Link2Off className="size-3.5 mr-1" />
                    Unlink
                  </Button>
                </div>
              )}
```

### Step 4: Add "Link counterpart" button to action bar (only when not already linked, not a child, not a transfer)

In the action bar, BEFORE the Delete button, insert:

```tsx
          {!t.linkedTransactionId && !t.parentId && t.type !== 'transfer' && (
            <Button variant="outline" onClick={() => setLinkPickerOpen(true)}>
              <Link2 className="size-4 mr-1" />
              Link counterpart
            </Button>
          )}
```

### Step 5: Render the picker

At the very end of the component's JSX (just before the closing `</Page>` or whatever wraps everything), add:

```tsx
        <CounterpartLinkPicker
          source={t}
          open={linkPickerOpen}
          onOpenChange={setLinkPickerOpen}
          isSubmitting={linkCounterpart.isPending}
          onPick={(targetId) => {
            linkCounterpart.mutate(
              { idA: t.id, idB: targetId },
              { onSuccess: () => setLinkPickerOpen(false) },
            )
          }}
        />
```

### Step 6: Build + tests

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 31 passing.

### Step 7: Commit

```bash
git add src/pages/transactions/\[id\]/index.tsx
git commit -m "$(cat <<'EOF'
feat: wire counterpart link/unlink on transaction view page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Type-check + build**

Run: `npm run build`
Expected: clean exit.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: 31 passing (matcher × 9 + existing 22).

- [ ] **Step 3: Manual smoke**

```
1. Create $50 expense on Account A (date 2026-05-13).
2. Create $50 income on Account B (date 2026-05-13).
3. Open view page of either. Click "Link counterpart".
4. Picker shows the other transaction. Click it.
5. Both view pages now show "⇄ Linked counterpart →" with an "Unlink" button.
6. List view: both rows show the ⇄ icon (Phase 1 badge).
7. /reports → expenses summary tile: $0 (pair collapsed). Income tile: $0.
   (Before linking, you'd see expense=50 + income=50 — after linking, one row
   represents the pair, neither shows as a category-attributed flow.)
8. Open one of the rows → click "Unlink". Both rows lose the chip + ⇄ icon.
   Reports show expense=50 + income=50 again.
9. Edge cases:
   - Linking opposite-type pairs on the SAME account → not in picker.
   - Linking ±10 days apart → not in picker.
   - Amount off by $1 → not in picker.
   - Already-linked row → not in picker.
   - Split children → not in picker.
   - Transfer rows → "Link counterpart" button hidden.
```

If any step fails, do NOT mark Phase 4 complete.

- [ ] **Step 4: Tag**

```bash
git tag phase-4-counterpart-linking
```

---

## Known follow-ups for Phase 5

- Recurring engine: `runDueRecurring()` on app load + per-template "Run now". Stamps `recurring_id` on generated transactions.
- View page action bar: "Create recurring from this" button + prefill flow.
- Recurring detail page: "Generated transactions" tab.
- Updates to recurring-detection guard (Phase 2 note in `src/api/recurring.ts`).
