# Transactions Overhaul — Phase 2: Exclude + One-time Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the `is_excluded` / `is_one_time` flags across every aggregate surface (summary tiles, budgets, reports, dashboard) per the spec §4.1 matrix, and surface the toggles to users on the TransactionForm edit page + view page.

**Architecture:** Add one new pass-through filter helper (`expandSplitChildrenForCategoryView` — no-op until Phase 3 lands split children) and compose existing helpers per surface. Budget progress is computed in a new `useBudgetsWithProgress` hook that fetches transactions and applies the filter chain (no API-side cross-resource query). UI toggles wired via existing zod schema fields.

**Tech Stack:** React 19, TypeScript, react-router-dom v6, @tanstack/react-query, react-hook-form + zod, vitest, tailwind.

**Source spec:** [`docs/superpowers/specs/2026-05-11-transactions-debts-recurring-overhaul-design.md`](../specs/2026-05-11-transactions-debts-recurring-overhaul-design.md), §4.1 and §7.

**Phase 1 status:** Complete. All helpers (`excludeExcluded`, `excludeOneTime`, `excludeSplitChildren`, `collapseLinkedPairs`) exist in `src/lib/transaction-filters.ts`, all schema columns persist, `applyTransactionEffects` is wired.

**Commit discipline:** Each task ends with a commit. Conventional commits — `feat:`, `refactor:`, `test:`. Trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## File structure (Phase 2)

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/lib/transaction-filters.ts` | Add `expandSplitChildrenForCategoryView` (no-op pass-through; ready for Phase 3 split children) |
| Modify | `src/lib/__tests__/transaction-filters.test.ts` | Test the new helper |
| Modify | `src/api/transactions.ts` | Apply filter chain inside `getAll` when `with_summary` |
| Create | `src/hooks/use-budgets-progress.ts` | `useBudgetsWithProgress()` — fetches budgets + transactions, computes `progress.spent` per budget |
| Modify | `src/hooks/index.ts` | Re-export the new hook |
| Modify | `src/pages/budgets/index.tsx` | Use the new hook instead of `useBudgets` |
| Modify | `src/pages/dashboard.tsx` | Use new hook for budgets; apply filter chain to current-month spend tile + projection |
| Modify | `src/api/reports.ts` | Apply filter chain on every report data path |
| Modify | `src/schemas/transactions.ts` | (No change — fields exist from Phase 1.) |
| Modify | `src/components/features/transactions/TransactionForm.tsx` | Add two checkboxes "Exclude from reports" and "Mark as one-time" |
| Modify | `src/pages/transactions/[id]/index.tsx` | Add quick-toggle buttons to the action bar |
| Modify | `src/hooks/use-transactions.ts` | Add `useToggleTransactionFlag` mutation for quick-toggles |

---

## Task 1: Add `expandSplitChildrenForCategoryView` pass-through helper (TDD)

**Files:**
- Modify: `src/lib/transaction-filters.ts`
- Modify: `src/lib/__tests__/transaction-filters.test.ts`

This helper will expand split parents into their children (so category reports attribute spend per child) once Phase 3 ships split children. Until then it's a no-op pass-through that strips the children-only filter, returning the input unchanged.

- [ ] **Step 1: Write the failing test**

Open `src/lib/__tests__/transaction-filters.test.ts`. Add a new import:

```ts
import {
  excludeExcluded,
  excludeOneTime,
  excludeSplitChildren,
  collapseLinkedPairs,
  expandSplitChildrenForCategoryView,
} from '@/lib/transaction-filters'
```

Append at the end of the file (before the final close):

```ts
describe('expandSplitChildrenForCategoryView', () => {
  it('returns the input unchanged when no split parents/children exist', () => {
    const list = [txn({ id: '1' }), txn({ id: '2' })]
    expect(expandSplitChildrenForCategoryView(list).map(t => t.id)).toEqual(['1', '2'])
  })
  it('preserves array order', () => {
    const list = [txn({ id: 'b' }), txn({ id: 'a' }), txn({ id: 'c' })]
    expect(expandSplitChildrenForCategoryView(list).map(t => t.id)).toEqual(['b', 'a', 'c'])
  })
})
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- src/lib/__tests__/transaction-filters.test.ts`
Expected: FAIL — "expandSplitChildrenForCategoryView is not exported".

- [ ] **Step 3: Implement**

Append to `src/lib/transaction-filters.ts`:

```ts
// Pass-through until Phase 3 lands split children. When children exist,
// this will replace each parent (whose id appears as another row's parentId)
// with its children, so category-attribution surfaces see per-category amounts.
// Today there are no split children so the input is returned unchanged.
export function expandSplitChildrenForCategoryView(
  txns: Transaction[],
): Transaction[] {
  return txns
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `npm test -- src/lib/__tests__/transaction-filters.test.ts`
Expected: 7 passing (5 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/transaction-filters.ts src/lib/__tests__/transaction-filters.test.ts
git commit -m "$(cat <<'EOF'
feat: add expandSplitChildrenForCategoryView pass-through helper

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Apply filter chain to `transactionsApi.getAll` summary

**Files:**
- Modify: `src/api/transactions.ts`

The current `getAll` with `with_summary: true` filters only by base currency. Need to also collapse linked pairs, hide split children, hide excluded rows. The summary tiles on the transactions page get these for free since they call `getSummary`.

- [ ] **Step 1: Update imports**

Open `src/api/transactions.ts`. Find the top-level imports. Add:

```ts
import {
  collapseLinkedPairs,
  excludeSplitChildren,
  excludeExcluded,
} from '@/lib/transaction-filters'
```

- [ ] **Step 2: Update the `with_summary` branch**

Find the `with_summary` block (around lines 142-160). Replace the existing `aggregateTxns` computation with:

```ts
    let summary: TransactionSummary | undefined
    if (filters?.with_summary) {
      const { baseCurrency, currency } = await getBaseCurrencyMeta()
      let aggregateTxns = txns.filter((transaction) =>
        isTransactionIncludedInBaseAggregates(transaction, baseCurrency?.id),
      )
      // Phase 2 matrix: summary tiles skip excluded, hide split children, collapse linked pairs.
      aggregateTxns = collapseLinkedPairs(aggregateTxns)
      aggregateTxns = excludeSplitChildren(aggregateTxns)
      aggregateTxns = excludeExcluded(aggregateTxns)
      const income = aggregateTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = aggregateTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      summary = {
        income,
        expense,
        transfer: aggregateTxns.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
        balance: income - expense,
        transactions_count: aggregateTxns.length,
        currency,
        decimals: baseCurrency?.decimals ?? 2,
      }
    }
```

- [ ] **Step 3: Build + tests**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: all tests still passing.

- [ ] **Step 4: Commit**

```bash
git add src/api/transactions.ts
git commit -m "$(cat <<'EOF'
feat: apply Phase 2 filter chain to transactions summary

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `useBudgetsWithProgress` hook

**Files:**
- Create: `src/hooks/use-budgets-progress.ts`
- Modify: `src/hooks/index.ts`

Computes per-budget `progress.spent` by fetching all transactions, applying the budget-specific filter chain (`collapseLinkedPairs → expandSplitChildrenForCategoryView → excludeExcluded → excludeOneTime`), then summing amounts matching the budget's categories/tags within its period.

- [ ] **Step 1: Inspect `Budget` and `BudgetProgress` types**

Run: `grep -n "interface Budget\|interface BudgetProgress" src/types/budgets.ts`
Open the file. Note the shape. `BudgetProgress` likely has `{ spent: number; remaining: number; percent: number; is_exceeded: boolean }`. Confirm field names before writing the hook so the produced object exactly matches what `src/components/features/budgets/columns.tsx` reads (`progress.spent`, `progress.percent`, `progress.is_exceeded`, `progress.remaining`).

- [ ] **Step 2: Create the hook**

Create `src/hooks/use-budgets-progress.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { budgetsApi } from '@/api/budgets'
import { transactionsApi } from '@/api/transactions'
import {
  collapseLinkedPairs,
  expandSplitChildrenForCategoryView,
  excludeExcluded,
  excludeOneTime,
} from '@/lib/transaction-filters'
import type { Budget } from '@/types'

function inPeriod(date: string, period: Budget['period'], start: string | null, end: string | null): boolean {
  const d = new Date(date)
  if (start && d < new Date(start)) return false
  if (end && d > new Date(end)) return false
  if (period === 'monthly') {
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  if (period === 'yearly') {
    return d.getFullYear() === new Date().getFullYear()
  }
  return true
}

function budgetMatchesTxn(budget: Budget, txn: { category?: { id: string }; tags: { id: string }[] }): boolean {
  if (budget.isGlobal) return true
  const categoryIds = (budget.categories ?? []).map(c => c.id)
  const tagIds = (budget.tags ?? []).map(t => t.id)
  if (categoryIds.length > 0 && txn.category && categoryIds.includes(txn.category.id)) return true
  if (tagIds.length > 0 && txn.tags.some(t => tagIds.includes(t.id))) return true
  return false
}

export function useBudgetsWithProgress() {
  return useQuery({
    queryKey: ['budgets-with-progress'],
    queryFn: async (): Promise<Budget[]> => {
      const [budgets, txnsResp] = await Promise.all([
        budgetsApi.getAll(),
        transactionsApi.getAll({ per_page: 99999, type: 'expense' }),
      ])

      // Phase 2 matrix: budget spent applies all four filters.
      let filtered = txnsResp.data
      filtered = collapseLinkedPairs(filtered)
      filtered = expandSplitChildrenForCategoryView(filtered)
      filtered = excludeExcluded(filtered)
      filtered = excludeOneTime(filtered)

      return budgets.map(b => {
        const matching = filtered.filter(t =>
          inPeriod(t.date, b.period, b.startDate, b.endDate) && budgetMatchesTxn(b, t)
        )
        const spent = matching.reduce((s, t) => s + t.amount, 0)
        const remaining = Math.max(0, b.amount - spent)
        const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0
        const isExceeded = spent > b.amount
        return {
          ...b,
          progress: { spent, remaining, percent, is_exceeded: isExceeded },
        }
      })
    },
  })
}
```

If the actual `Budget.categories` / `Budget.tags` types differ from `{ id: string }[]`, adjust the `budgetMatchesTxn` accordingly. If `BudgetProgress` field names differ (e.g. `isExceeded` not `is_exceeded`), match what the columns file actually reads.

- [ ] **Step 3: Re-export from hooks index**

Open `src/hooks/index.ts`. Add:

```ts
export { useBudgetsWithProgress } from './use-budgets-progress'
```

(Adjust if the file uses re-export-all pattern.)

- [ ] **Step 4: Build + tests**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: still passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-budgets-progress.ts src/hooks/index.ts
git commit -m "$(cat <<'EOF'
feat: add useBudgetsWithProgress hook with filter-chain spent computation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire `useBudgetsWithProgress` into budgets page

**Files:**
- Modify: `src/pages/budgets/index.tsx`

- [ ] **Step 1: Swap the hook**

Open `src/pages/budgets/index.tsx`. Find:

```ts
import { useBudgets, useDeleteBudget } from '@/hooks';
```

Change to:

```ts
import { useBudgetsWithProgress, useDeleteBudget } from '@/hooks';
```

Find:

```ts
const { data: budgets, isLoading } = useBudgets();
```

Change to:

```ts
const { data: budgets, isLoading } = useBudgetsWithProgress();
```

- [ ] **Step 2: Build + manual smoke**

Run: `npm run build`
Expected: clean.

Manual smoke (deferred to final verification task): visit `/budgets`. Each budget row should now show a populated progress bar (was empty before since `progress` was never set).

- [ ] **Step 3: Commit**

```bash
git add src/pages/budgets/index.tsx
git commit -m "$(cat <<'EOF'
feat: use useBudgetsWithProgress on /budgets page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `useBudgetsWithProgress` into dashboard + filter dashboard month tile

**Files:**
- Modify: `src/pages/dashboard.tsx`

The dashboard currently reads `budget.progress` from `useBudgets` (always undefined). Also the current-month spend tile needs to skip excluded transactions.

- [ ] **Step 1: Inspect current usage**

Run: `grep -n "useBudgets\|budget.progress\|monthData" src/pages/dashboard.tsx`. Confirm:
- A `useBudgets()` (or similar) call exists.
- `monthData` is fetched via `useTransactions({...})` for the current month.

- [ ] **Step 2: Swap budgets hook**

Find `useBudgets` import and call. Replace with `useBudgetsWithProgress`. Adjust destructuring if needed (same return shape).

- [ ] **Step 3: Apply filter chain to the month spend computation**

Find where `monthData` is reduced into a "current-month spend" number. Before the reduce, apply:

```ts
import {
  collapseLinkedPairs,
  excludeSplitChildren,
  excludeExcluded,
} from '@/lib/transaction-filters'

// ...inside the component, after monthData is available:
let filteredMonth = monthData?.data ?? []
filteredMonth = collapseLinkedPairs(filteredMonth)
filteredMonth = excludeSplitChildren(filteredMonth)
filteredMonth = excludeExcluded(filteredMonth)
// Then sum filteredMonth.filter(t => t.type === 'expense').reduce(...)
```

The plan keeps `one-time` rows in the current-month tile (per matrix). For any "projection" / "cashflow forecast" tile, also strip one-time:

```ts
let filteredForProjection = filteredMonth
filteredForProjection = filteredForProjection.filter(t => !t.isOneTime)
// use this for projection math
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard.tsx
git commit -m "$(cat <<'EOF'
feat: filter excluded/one-time on dashboard tiles and use progress hook

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Apply filter chain across reports

**Files:**
- Modify: `src/api/reports.ts`

`reports.ts` calls `transactionsApi.getAll({ per_page: 99999 })` once and uses the data across charts. Apply the right filter chain at the start, then split into per-chart subsets.

- [ ] **Step 1: Inspect**

Run: `grep -n "transactionsApi.getAll\|export const\|export function" src/api/reports.ts | head -20`. Note the structure — typically a single fetch followed by per-chart aggregations.

- [ ] **Step 2: Apply chain**

Open `src/api/reports.ts`. Find the line `transactionsApi.getAll({ per_page: 99999 })`. After awaiting, store the raw array, then derive two filtered subsets:

```ts
import {
  collapseLinkedPairs,
  expandSplitChildrenForCategoryView,
  excludeSplitChildren,
  excludeExcluded,
  excludeOneTime,
} from '@/lib/transaction-filters'

// ...inside the function where transactions are fetched:
const raw = (await transactionsApi.getAll({ per_page: 99999 })).data

// Category surfaces: expand children, drop excluded (keep one-time in raw spend totals)
let categoryView = raw
categoryView = collapseLinkedPairs(categoryView)
categoryView = expandSplitChildrenForCategoryView(categoryView)
categoryView = excludeExcluded(categoryView)

// Trend surfaces: skip excluded + one-time so averages aren't skewed
let trendView = raw
trendView = collapseLinkedPairs(trendView)
trendView = excludeSplitChildren(trendView)
trendView = excludeExcluded(trendView)
trendView = excludeOneTime(trendView)
```

Then use `categoryView` for ExpensesByCategory, ExpensesStructureChart, IncomeStructureChart, TopExpenses, TopIncome, Sankey. Use `trendView` for ExpensesDynamicsChart, IncomeDynamicsChart, NetWorthChart, CashFlowChart, ExpensePaceChart, ActivityHeatmap.

If `reports.ts` is structured as a single function that returns one shape, plumb both subsets into the return object and update the per-chart accessors. If it's structured as separate functions, pass the right subset to each. Make the minimum changes — do not refactor the file shape.

- [ ] **Step 3: Build + tests**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: still passing.

- [ ] **Step 4: Commit**

```bash
git add src/api/reports.ts
git commit -m "$(cat <<'EOF'
feat: apply Phase 2 filter chains to reports (category vs trend views)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add "Exclude" + "One-time" toggles to TransactionForm

**Files:**
- Modify: `src/components/features/transactions/TransactionForm.tsx`

Two checkboxes near the description field. Disabled-when-other-is-checked enforces the mutex (zod refinement also enforces it on submit).

- [ ] **Step 1: Add imports**

Open `src/components/features/transactions/TransactionForm.tsx`. Add to the existing imports:

```tsx
import { Checkbox } from '@/components/ui/checkbox'
```

(If already imported, skip.)

- [ ] **Step 2: Extend `formDefaults`**

Find the `formDefaults = useMemo(() => { ... })` block. Add the two flag defaults:

```ts
    is_excluded: defaultValues?.is_excluded ?? false,
    is_one_time: defaultValues?.is_one_time ?? false,
```

Add them alongside the other field defaults.

- [ ] **Step 3: Add the two checkboxes to the form**

Find the Description FormField (renders the textarea). Add immediately AFTER it, BEFORE the Tags FormField:

```tsx
          {/* Flags */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <FormField
              control={form.control}
              name="is_excluded"
              render={({ field }) => {
                const isOneTime = form.watch('is_one_time')
                return (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        disabled={!!isOneTime}
                        onCheckedChange={(v) => field.onChange(!!v)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel>Exclude from reports</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Hidden from every aggregate. Account balance still counts it.
                      </p>
                    </div>
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="is_one_time"
              render={({ field }) => {
                const isExcluded = form.watch('is_excluded')
                return (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        disabled={!!isExcluded}
                        onCheckedChange={(v) => field.onChange(!!v)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel>Mark as one-time</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Counted in raw totals but skipped from averages and projections.
                      </p>
                    </div>
                  </FormItem>
                )
              }}
            />
          </div>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/transactions/TransactionForm.tsx
git commit -m "$(cat <<'EOF'
feat: add exclude/one-time toggles to TransactionForm

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add `useToggleTransactionFlag` quick-toggle mutation hook

**Files:**
- Modify: `src/hooks/use-transactions.ts`

Used by the view page's action bar to flip a flag without entering the edit form.

- [ ] **Step 1: Add the hook**

Open `src/hooks/use-transactions.ts`. Locate other mutation hooks (e.g. `useDeleteTransaction`). After the last hook, append:

```ts
export function useToggleTransactionFlag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      id: string | number
      flag: 'is_excluded' | 'is_one_time'
      value: boolean
    }) => {
      return transactionsApi.update(params.id, { [params.flag]: params.value })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Transaction updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update transaction')
    },
  })
}
```

Confirm `QUERY_KEY` and `toast` are already imported at the top of the file (they should be — used by sibling hooks). If not, add them.

- [ ] **Step 2: Re-export if needed**

Open `src/hooks/index.ts`. If the file re-exports specific hook names, add `useToggleTransactionFlag`. If it uses `export *`, no change needed.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-transactions.ts src/hooks/index.ts
git commit -m "$(cat <<'EOF'
feat: add useToggleTransactionFlag mutation hook

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add quick-toggle buttons to view page action bar

**Files:**
- Modify: `src/pages/transactions/[id]/index.tsx`

- [ ] **Step 1: Add imports**

Near the top of `src/pages/transactions/[id]/index.tsx`, add:

```tsx
import { Ban, Star } from 'lucide-react'
import { useToggleTransactionFlag } from '@/hooks'
```

- [ ] **Step 2: Wire the hook**

Inside the component, after the existing mutation hooks (e.g. `const deleteTransaction = ...`), add:

```ts
const toggleFlag = useToggleTransactionFlag()
```

- [ ] **Step 3: Add buttons before Delete**

Find the action bar's button group. Insert the two new buttons before the Delete button:

```tsx
          <Button
            variant={t.isExcluded ? 'default' : 'outline'}
            onClick={() => toggleFlag.mutate({ id: t.id, flag: 'is_excluded', value: !t.isExcluded })}
            disabled={toggleFlag.isPending || t.isOneTime}
            title={t.isOneTime ? 'Cannot exclude a one-time transaction' : ''}
          >
            <Ban className="size-4 mr-1" />
            {t.isExcluded ? 'Included' : 'Exclude'}
          </Button>
          <Button
            variant={t.isOneTime ? 'default' : 'outline'}
            onClick={() => toggleFlag.mutate({ id: t.id, flag: 'is_one_time', value: !t.isOneTime })}
            disabled={toggleFlag.isPending || t.isExcluded}
            title={t.isExcluded ? 'Cannot mark excluded transaction as one-time' : ''}
          >
            <Star className="size-4 mr-1" />
            {t.isOneTime ? 'Recurring-like' : 'Mark one-time'}
          </Button>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/transactions/\[id\]/index.tsx
git commit -m "$(cat <<'EOF'
feat: add exclude/one-time quick-toggle buttons to transaction view page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Recurring-detection / suggestions filter (only if a suggester exists)

**Files:**
- Possibly modify: `src/api/recurring.ts` or wherever recurring suggestions are derived.

Spec §4.1 says recurring detection should skip excluded + one-time rows. Most projects don't ship this feature yet (Phase 5 adds the recurring engine). Inspect quickly:

```bash
grep -rn "detect\|suggest" src/api/recurring.ts src/hooks/use-recurring.ts 2>/dev/null
```

If a detection/suggestion function exists, prepend it with:

```ts
let candidates = (await transactionsApi.getAll({ per_page: 99999 })).data
candidates = candidates.filter(t => !t.isExcluded && !t.isOneTime && !t.parentId)
```

If no such function exists (likely the case in Phase 1), skip this task entirely. Add a TODO comment in `src/api/recurring.ts` near the top of the file:

```ts
// Phase 2 NOTE: when a recurring-detection feature is added (Phase 5 engine),
// it must filter out is_excluded, is_one_time, and split children before
// matching candidates. See spec §4.1 matrix row 'Recurring detection'.
```

Commit:

```bash
git add src/api/recurring.ts
git commit -m "$(cat <<'EOF'
docs: note Phase 2 filter requirements for future recurring detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

If unchanged, skip the commit.

---

## Task 11: Final verification

- [ ] **Step 1: Type-check + build**

Run: `npm run build`
Expected: clean exit, no errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: ≥ 19 tests passing (17 from Phase 1 + 2 new from Task 1).

- [ ] **Step 3: Manual smoke checklist**

Run `npm run dev` and walk through:

```
1. /transactions: create a new expense. Tick "Mark as one-time". Save.
   - Row appears with ★ icon.
   - Summary tiles unchanged (one-time still counts in summary).
2. Click the same row → view page. Click "Recurring-like" to clear the flag.
   - ★ disappears.
3. Edit the row, tick "Exclude from reports". Save.
   - Row appears faded with ⊘.
   - Summary tiles drop by the row's amount.
4. /budgets: budget rows show populated progress bars (was empty pre-Phase-2).
   - If the excluded row matched any budget, that budget's spent is unchanged
     (excluded is dropped).
   - If a one-time row matched a budget, its spent is also unchanged.
5. /reports: ExpensesByCategory shows numbers consistent with non-excluded
   transactions. Trends/averages skip both excluded AND one-time.
6. /: dashboard current-month tile reflects expense minus the excluded row.
   Projection tile skips both excluded and one-time.
```

If any step fails, do NOT mark Phase 2 done. Diagnose. Most likely culprit: filter chain order or a missed surface.

- [ ] **Step 4: Tag the release**

```bash
git tag phase-2-exclude-onetime
```

---

## Done?

Phase 2 complete when:
- Build clean, tests green
- Manual smoke checklist all green
- Excluded transactions invisible to budgets/reports/dashboard tiles
- One-time transactions visible in raw totals but skipped from budgets/projections/trends
- Form + view page both let users toggle the flags

Next: Phase 3 (split transactions + items unification). Spec §4.2 + §8.
