# Budget Page Fix & Redesign

**Date:** 2026-05-23  
**Status:** Approved

---

## Problem Summary

Four bugs + one missing feature:

1. **Categories always `[]`** — `toBudget()` in `src/api/budgets.ts` hardcodes `categories: []` and `tags: []`. DB stores `category_ids` and `tag_ids` as comma-separated strings, never resolved back to objects.
2. **Progress bar stuck at 0** — caused by bug #1. `budgetMatchesTxn` returns false for all non-global budgets because `budget.categories.length === 0`.
3. **Edit form shows no checked categories** — caused by bug #1. `budget.categories.map(c => c.id)` returns `[]`.
4. **Currency not pre-selected** — `BudgetForm` defaults `currency_id: null`; base currency never auto-selected.
5. **No budget view page** — `/budgets/:id` route does not exist.

---

## Architecture

### Fix 1 — Resolve categories/tags in API layer

**File:** `src/api/budgets.ts`

Update `budgetsApi.getAll()` and `budgetsApi.getById()` to also fetch all categories and tags from the adapter, then resolve the stored CSV strings into typed arrays.

```
category_ids: "uuid1,uuid2"  →  categories: [{ id, name, icon, color, type }, ...]
tag_ids: "uuid1"             →  tags: [{ id, name }, ...]
```

`toBudget` becomes a pure transform that takes the raw record plus pre-fetched category/tag maps. Alternatively, `getAll`/`getById` call `categoriesApi.getAll()` and `tagsApi.getAll()` (both are cheap local reads), build lookup maps, and resolve before returning.

**Why API layer, not hook layer:** `useBudget` (used by edit page) and `useBudgetsWithProgress` both depend on `budgetsApi`. Fixing it once here fixes all consumers. No duplication.

### Fix 2 — Base currency preselection in form

**File:** `src/components/features/budgets/BudgetForm.tsx`

`useCurrencies()` is already called. Add logic:

```ts
const baseCurrency = currencies?.find(c => c.isBase)
// in useForm defaultValues:
currency_id: defaultValues?.currency_id ?? baseCurrency?.id ?? null
```

Use `useEffect` or compute after currencies load since `currencies` is async. Pattern: watch `currencies` load, then `form.setValue('currency_id', baseCurrency.id)` only if the field is still null/empty and no explicit `defaultValues.currency_id` was passed.

### Fix 3 — Budget list page redesign

**File:** `src/pages/budgets/index.tsx`  
**File:** `src/components/features/budgets/BudgetCard.tsx` (new)

Replace `ListPage` table with a responsive card grid. Each card:
- **Header row:** name (bold) + period badge + status badge
- **Categories row:** `CategoryPill` components (or "All expenses" for global)
- **Progress section:** `<amount spent> / <limit>` with progress bar, color red if exceeded
- **Footer:** remaining or "Exceeded by X" text
- Click whole card → `/budgets/:id`
- Overflow menu (edit, delete) stays in top-right corner of card

Layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

### Feature — Budget view page

**File:** `src/pages/budgets/[id]/index.tsx` (new)

**Data:** Uses `useBudgetsWithProgress()` to find the budget (avoids a second fetch), or a dedicated hook that computes progress for a single budget with a custom period offset.

Actually: create a new hook `useBudgetWithProgress(id, periodOffset)` that:
1. Fetches the budget by id (already resolved categories/tags after fix #1)
2. Fetches all expense transactions
3. Computes period bounds for current period + `periodOffset` (e.g. -1 = prev month)
4. Filters transactions by period + budget match
5. Returns `{ budget, progress, transactions }`

**Period offset navigation:**
- State: `const [offset, setOffset] = useState(0)` (0 = current period)
- For `monthly`: compute `startOfMonth(subMonths(now, -offset))`
- For `weekly`: compute `startOfWeek(subWeeks(now, -offset))`
- For `yearly`: compute year - offset
- For `one_time`: no nav (offset irrelevant, fixed dates)

**Page sections:**

1. **Breadcrumb:** `← Budgets`
2. **Hero card:** name, period badge, edit button
3. **Time navigator** (monthly/weekly/yearly only):
   - `< [label] >` — e.g. `< May 2026 >` or `< May 19–25 >`
   - Disable "next" if offset = 0 (current period is the latest)
4. **Progress card:** big progress bar, spent / limit amounts, remaining or exceeded amount, percent
5. **Transactions list:** grouped or flat list of matching expense transactions for this period. Each row: date, description, category pill, amount. Click → `/transactions/:id`

**Empty state:** "No transactions in this period"

### Router update

**File:** `src/app/router.tsx`

Add lazy import and route:
```ts
const BudgetViewPage = lazy(() => import('@/pages/budgets/[id]/index'))
// in routes:
{ path: 'budgets/:id', element: withSuspense(BudgetViewPage) }
```

Add before `budgets/:id/edit` so router priority is correct.

Also update `columns.tsx` dropdown to add "View" link alongside "Edit".

---

## Data Flow

```
budgetsApi.getAll()
  → adapter.getAll('budgets')        raw rows with category_ids CSV
  → categoriesApi.getAll()           all categories
  → tagsApi.getAll()                 all tags
  → resolve CSV → Category[]/Tag[]
  → return Budget[] with populated categories/tags

useBudgetsWithProgress()             list page + existing hook (categories now populated)
  → budgetMatchesTxn now works       progress bar shows real data

useBudgetWithProgress(id, offset)    view page hook (new)
  → fetches budget + transactions
  → filters by period offset
  → returns { budget, progress, transactions[] }
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/api/budgets.ts` | Resolve category_ids/tag_ids in getAll/getById |
| `src/components/features/budgets/BudgetForm.tsx` | Auto-select base currency |
| `src/components/features/budgets/BudgetCard.tsx` | New card component |
| `src/components/features/budgets/index.ts` | Export BudgetCard |
| `src/pages/budgets/index.tsx` | Redesign: card grid instead of ListPage table |
| `src/pages/budgets/[id]/index.tsx` | New view page |
| `src/hooks/use-budgets-progress.ts` | New `useBudgetWithProgress(id, offset)` export |
| `src/app/router.tsx` | Add budgets/:id route |
| `src/components/features/budgets/columns.tsx` | Add "View" link to dropdown |

---

## Out of Scope

- Notification system for `notifyAtPercent`
- Currency conversion across budgets
- Budget analytics / charts
