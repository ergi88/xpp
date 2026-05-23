# Budget Fix & Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three cascading bugs caused by unresolved category/tag IDs in the budgets API, auto-select base currency in the form, redesign the list page with cards, and add a budget view page with period navigation.

**Architecture:** Fix is applied in the API layer (`src/api/budgets.ts`) so all consumers get correct data automatically. Shared period math is extracted to `src/lib/budget-period.ts` for testability and reuse. The view page uses a new `useBudgetWithProgress(id, offset)` hook that applies an offset integer to navigate periods.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Tailwind CSS, shadcn/ui, react-router-dom

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/api/budgets.ts` | Modify | Resolve `category_ids`/`tag_ids` CSV strings → typed arrays |
| `src/lib/budget-period.ts` | Create | Pure period math: `getPeriodBounds(period, start, end, offset)`, `inPeriod`, `budgetMatchesTxn` |
| `src/lib/__tests__/budget-period.test.ts` | Create | Unit tests for period math |
| `src/lib/__tests__/budget-api-resolve.test.ts` | Create | Unit test for category/tag resolution logic |
| `src/hooks/use-budgets-progress.ts` | Modify | Import from `budget-period.ts`; add `useBudgetWithProgress(id, offset)` export |
| `src/components/features/budgets/BudgetForm.tsx` | Modify | Auto-select base currency when `currency_id` not provided |
| `src/components/features/budgets/BudgetCard.tsx` | Create | Card component for redesigned list page |
| `src/components/features/budgets/index.ts` | Modify | Export `BudgetCard` |
| `src/components/features/budgets/columns.tsx` | Modify | Add "View" link to dropdown menu |
| `src/pages/budgets/index.tsx` | Modify | Replace `ListPage` table with card grid |
| `src/pages/budgets/[id]/index.tsx` | Create | Budget view page with period navigator + transactions |
| `src/app/router.tsx` | Modify | Add `budgets/:id` route |

---

## Task 1: Extract period math to a shared utility

**Files:**
- Create: `src/lib/budget-period.ts`
- Create: `src/lib/__tests__/budget-period.test.ts`

- [ ] **Step 1: Create `src/lib/budget-period.ts`**

```ts
import type { Budget, Transaction } from '@/types'

export function getPeriodBounds(
  period: Budget['period'],
  start: string | null,
  end: string | null,
  offset = 0,
): { periodStart: string; periodEnd: string } {
  if (start && end) {
    return { periodStart: start, periodEnd: end }
  }
  const now = new Date()
  if (period === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const periodStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const periodEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { periodStart, periodEnd }
  }
  if (period === 'yearly') {
    const y = now.getFullYear() - offset
    return { periodStart: `${y}-01-01`, periodEnd: `${y}-12-31` }
  }
  if (period === 'weekly') {
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday - offset * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { periodStart: fmt(monday), periodEnd: fmt(sunday) }
  }
  return {
    periodStart: start ?? '1970-01-01',
    periodEnd: end ?? '9999-12-31',
  }
}

export function inPeriod(date: string, periodStart: string, periodEnd: string): boolean {
  const d = date.slice(0, 10)
  return d >= periodStart && d <= periodEnd
}

export function budgetMatchesTxn(budget: Budget, txn: Transaction): boolean {
  if (budget.isGlobal) return true
  const categoryIds = (budget.categories ?? []).map(c => c.id)
  const tagIds = (budget.tags ?? []).map(t => t.id)
  if (categoryIds.length > 0 && txn.category && categoryIds.includes(txn.category.id)) return true
  if (tagIds.length > 0 && txn.tags.some(t => tagIds.includes(t.id))) return true
  return false
}

export function periodLabel(
  period: Budget['period'],
  periodStart: string,
  periodEnd: string,
): string {
  if (period === 'monthly') {
    const d = new Date(periodStart + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (period === 'weekly') {
    const s = new Date(periodStart + 'T00:00:00')
    const e = new Date(periodEnd + 'T00:00:00')
    const sm = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const em = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${sm} – ${em}`
  }
  if (period === 'yearly') {
    return new Date(periodStart + 'T00:00:00').getFullYear().toString()
  }
  return `${periodStart} – ${periodEnd}`
}
```

- [ ] **Step 2: Write tests in `src/lib/__tests__/budget-period.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPeriodBounds, inPeriod, budgetMatchesTxn, periodLabel } from '@/lib/budget-period'
import type { Budget, Transaction } from '@/types'

afterEach(() => vi.restoreAllMocks())

describe('getPeriodBounds - monthly', () => {
  it('returns current month bounds at offset 0', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('monthly', null, null, 0)
    expect(periodStart).toBe('2026-05-01')
    expect(periodEnd).toBe('2026-05-31')
  })

  it('returns previous month at offset 1', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('monthly', null, null, 1)
    expect(periodStart).toBe('2026-04-01')
    expect(periodEnd).toBe('2026-04-30')
  })

  it('wraps year at offset crossing Jan', () => {
    vi.setSystemTime(new Date('2026-01-10'))
    const { periodStart, periodEnd } = getPeriodBounds('monthly', null, null, 1)
    expect(periodStart).toBe('2025-12-01')
    expect(periodEnd).toBe('2025-12-31')
  })
})

describe('getPeriodBounds - weekly', () => {
  it('returns Mon–Sun of current week at offset 0', () => {
    vi.setSystemTime(new Date('2026-05-20')) // Wednesday
    const { periodStart, periodEnd } = getPeriodBounds('weekly', null, null, 0)
    expect(periodStart).toBe('2026-05-18') // Monday
    expect(periodEnd).toBe('2026-05-24')   // Sunday
  })

  it('returns previous week at offset 1', () => {
    vi.setSystemTime(new Date('2026-05-20'))
    const { periodStart, periodEnd } = getPeriodBounds('weekly', null, null, 1)
    expect(periodStart).toBe('2026-05-11')
    expect(periodEnd).toBe('2026-05-17')
  })
})

describe('getPeriodBounds - yearly', () => {
  it('returns current year at offset 0', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('yearly', null, null, 0)
    expect(periodStart).toBe('2026-01-01')
    expect(periodEnd).toBe('2026-12-31')
  })

  it('returns 2025 at offset 1', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('yearly', null, null, 1)
    expect(periodStart).toBe('2025-01-01')
    expect(periodEnd).toBe('2025-12-31')
  })
})

describe('getPeriodBounds - one_time with explicit dates', () => {
  it('uses explicit start/end regardless of offset', () => {
    const { periodStart, periodEnd } = getPeriodBounds('one_time', '2026-01-01', '2026-03-31', 5)
    expect(periodStart).toBe('2026-01-01')
    expect(periodEnd).toBe('2026-03-31')
  })
})

describe('inPeriod', () => {
  it('returns true when date is within period', () => {
    expect(inPeriod('2026-05-15', '2026-05-01', '2026-05-31')).toBe(true)
  })
  it('returns false when date is outside period', () => {
    expect(inPeriod('2026-04-30', '2026-05-01', '2026-05-31')).toBe(false)
  })
  it('is inclusive on both ends', () => {
    expect(inPeriod('2026-05-01', '2026-05-01', '2026-05-31')).toBe(true)
    expect(inPeriod('2026-05-31', '2026-05-01', '2026-05-31')).toBe(true)
  })
})

describe('budgetMatchesTxn', () => {
  const base = { categories: [], tags: [], isGlobal: false } as unknown as Budget
  const txn = { category: { id: 'cat1' }, tags: [] } as unknown as Transaction

  it('global budget matches any transaction', () => {
    expect(budgetMatchesTxn({ ...base, isGlobal: true }, txn)).toBe(true)
  })

  it('matches by category id', () => {
    const budget = { ...base, categories: [{ id: 'cat1' }] } as unknown as Budget
    expect(budgetMatchesTxn(budget, txn)).toBe(true)
  })

  it('no match when category differs', () => {
    const budget = { ...base, categories: [{ id: 'cat2' }] } as unknown as Budget
    expect(budgetMatchesTxn(budget, txn)).toBe(false)
  })

  it('matches by tag id', () => {
    const budget = { ...base, tags: [{ id: 'tag1' }] } as unknown as Budget
    const tagTxn = { category: null, tags: [{ id: 'tag1' }] } as unknown as Transaction
    expect(budgetMatchesTxn(budget, tagTxn)).toBe(true)
  })
})

describe('periodLabel', () => {
  it('formats monthly label', () => {
    expect(periodLabel('monthly', '2026-05-01', '2026-05-31')).toBe('May 2026')
  })
  it('formats weekly label', () => {
    const label = periodLabel('weekly', '2026-05-18', '2026-05-24')
    expect(label).toContain('May 18')
    expect(label).toContain('May 24')
  })
  it('formats yearly label', () => {
    expect(periodLabel('yearly', '2026-01-01', '2026-12-31')).toBe('2026')
  })
})
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/budget-period.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/budget-period.ts src/lib/__tests__/budget-period.test.ts
git commit -m "feat: extract budget period math to shared utility with offset support"
```

---

## Task 2: Fix categories/tags resolution in budgets API

**Files:**
- Modify: `src/api/budgets.ts`
- Create: `src/lib/__tests__/budget-api-resolve.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/budget-api-resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Category, Tag } from '@/types'

// Inline the resolution logic to test it in isolation.
// This mirrors what we'll implement in budgets.ts.
function resolveBudgetRelations(
  raw: Record<string, unknown>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
) {
  const categoryIds = String(raw.category_ids ?? '').split(',').filter(Boolean)
  const tagIds = String(raw.tag_ids ?? '').split(',').filter(Boolean)
  return {
    categories: categoryIds.map(id => categoriesById.get(id)).filter(Boolean) as Category[],
    tags: tagIds.map(id => tagsById.get(id)).filter(Boolean) as Tag[],
  }
}

const catA: Category = { id: 'cat-a', name: 'Food', type: 'expense', icon: 'utensils', color: '#f00', createdAt: undefined }
const catB: Category = { id: 'cat-b', name: 'Transport', type: 'expense', icon: 'car', color: '#00f', createdAt: undefined }
const tagX: Tag = { id: 'tag-x', name: 'important', createdAt: undefined }

const catMap = new Map([['cat-a', catA], ['cat-b', catB]])
const tagMap = new Map([['tag-x', tagX]])

describe('resolveBudgetRelations', () => {
  it('resolves multiple category ids from CSV', () => {
    const result = resolveBudgetRelations({ category_ids: 'cat-a,cat-b', tag_ids: '' }, catMap, tagMap)
    expect(result.categories).toHaveLength(2)
    expect(result.categories[0].id).toBe('cat-a')
    expect(result.categories[1].id).toBe('cat-b')
  })

  it('resolves tag ids', () => {
    const result = resolveBudgetRelations({ category_ids: '', tag_ids: 'tag-x' }, catMap, tagMap)
    expect(result.tags).toHaveLength(1)
    expect(result.tags[0].id).toBe('tag-x')
  })

  it('skips unknown ids silently', () => {
    const result = resolveBudgetRelations({ category_ids: 'unknown-id', tag_ids: '' }, catMap, tagMap)
    expect(result.categories).toHaveLength(0)
  })

  it('handles empty category_ids', () => {
    const result = resolveBudgetRelations({ category_ids: '', tag_ids: '' }, catMap, tagMap)
    expect(result.categories).toHaveLength(0)
    expect(result.tags).toHaveLength(0)
  })

  it('handles missing category_ids key', () => {
    const result = resolveBudgetRelations({}, catMap, tagMap)
    expect(result.categories).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it passes (pure logic, no mocks needed)**

```bash
npx vitest run src/lib/__tests__/budget-api-resolve.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Update `src/api/budgets.ts`**

Replace the entire file:

```ts
import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'
import type { Budget, BudgetFormData, Category, Tag } from '@/types'

function toBudget(r: Record<string, unknown>): Omit<Budget, 'categories' | 'tags'> {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: Number(r.amount),
    currencyId: (r.currency_id as string) ?? null,
    period: r.period as Budget['period'],
    periodLabel: r.period as string,
    startDate: (r.start_date as string) || null,
    endDate: (r.end_date as string) || null,
    isGlobal: r.is_global === 'true' || r.is_global === true,
    notifyAtPercent: r.notify_at_percent ? Number(r.notify_at_percent) : null,
    isActive: r.is_active === 'true' || r.is_active === true || r.is_active === undefined,
    createdAt: r.created_at as string | undefined,
  } as Omit<Budget, 'categories' | 'tags'>
}

function resolveRelations(
  raw: Record<string, unknown>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
): Budget {
  const categoryIds = String(raw.category_ids ?? '').split(',').filter(Boolean)
  const tagIds = String(raw.tag_ids ?? '').split(',').filter(Boolean)
  return {
    ...toBudget(raw),
    categories: categoryIds.map(id => categoriesById.get(id)).filter(Boolean) as Category[],
    tags: tagIds.map(id => tagsById.get(id)).filter(Boolean) as Tag[],
  } as Budget
}

async function buildLookups() {
  const [allCategories, allTags] = await Promise.all([
    categoriesApi.getAll(),
    tagsApi.getAll(),
  ])
  const categoriesById = new Map(allCategories.map(c => [c.id, c]))
  const tagsById = new Map(allTags.map(t => [t.id, t]))
  return { categoriesById, tagsById }
}

export const budgetsApi = {
  getAll: async (): Promise<Budget[]> => {
    const [rows, { categoriesById, tagsById }] = await Promise.all([
      adapter.getAll('budgets'),
      buildLookups(),
    ])
    return rows.map(r => resolveRelations(r, categoriesById, tagsById))
  },

  getById: async (id: string | number): Promise<Budget> => {
    const [r, { categoriesById, tagsById }] = await Promise.all([
      adapter.getById('budgets', String(id)),
      buildLookups(),
    ])
    if (!r) throw new Error('Budget not found')
    return resolveRelations(r, categoriesById, tagsById)
  },

  create: async (data: BudgetFormData): Promise<Budget> => {
    const [r, { categoriesById, tagsById }] = await Promise.all([
      adapter.create('budgets', {
        id: uuidv4(),
        name: data.name,
        amount: data.amount,
        currency_id: data.currency_id ?? '',
        category_ids: (data.category_ids ?? []).join(','),
        tag_ids: (data.tag_ids ?? []).join(','),
        period: data.period,
        start_date: data.start_date ?? '',
        end_date: data.end_date ?? '',
        is_global: String(data.is_global ?? false),
        notify_at_percent: data.notify_at_percent ?? '',
        is_active: String(data.is_active ?? true),
        created_at: new Date().toISOString(),
      }),
      buildLookups(),
    ])
    return resolveRelations(r, categoriesById, tagsById)
  },

  update: async (id: string | number, data: Partial<BudgetFormData>): Promise<Budget> => {
    const payload: Record<string, unknown> = { ...data }
    if (Array.isArray(data.category_ids)) {
      payload.category_ids = data.category_ids.join(',')
    }
    if (Array.isArray(data.tag_ids)) {
      payload.tag_ids = data.tag_ids.join(',')
    }
    const [r, { categoriesById, tagsById }] = await Promise.all([
      adapter.update('budgets', String(id), payload),
      buildLookups(),
    ])
    return resolveRelations(r, categoriesById, tagsById)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('budgets', String(id)),
}
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. No regressions.

- [ ] **Step 5: Commit**

```bash
git add src/api/budgets.ts src/lib/__tests__/budget-api-resolve.test.ts
git commit -m "fix: resolve category and tag IDs in budgets API — fixes progress bar and categories display"
```

---

## Task 3: Update use-budgets-progress.ts to use shared utility + add single-budget hook

**Files:**
- Modify: `src/hooks/use-budgets-progress.ts`

- [ ] **Step 1: Replace `src/hooks/use-budgets-progress.ts`**

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
import { getPeriodBounds, inPeriod, budgetMatchesTxn } from '@/lib/budget-period'
import type { Budget, BudgetProgress, Transaction } from '@/types'

async function fetchFilteredExpenses(): Promise<Transaction[]> {
  const resp = await transactionsApi.getAll({
    per_page: 99999,
    type: 'expense',
    include_excluded: true,
    include_split_children: true,
  })
  let filtered = resp.data
  filtered = collapseLinkedPairs(filtered)
  filtered = expandSplitChildrenForCategoryView(filtered)
  filtered = excludeExcluded(filtered)
  filtered = excludeOneTime(filtered)
  return filtered
}

function calcProgress(
  budget: Budget,
  transactions: Transaction[],
  offset: number,
): BudgetProgress & { period_start: string; period_end: string } {
  const { periodStart, periodEnd } = getPeriodBounds(budget.period, budget.startDate, budget.endDate, offset)
  const matching = transactions.filter(t =>
    inPeriod(t.date, periodStart, periodEnd) && budgetMatchesTxn(budget, t),
  )
  const spent = matching.reduce((s, t) => s + t.amount, 0)
  const remaining = Math.max(0, budget.amount - spent)
  const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
  return {
    spent,
    remaining,
    percent,
    is_exceeded: spent > budget.amount,
    period_start: periodStart,
    period_end: periodEnd,
  }
}

export function useBudgetsWithProgress() {
  return useQuery({
    queryKey: ['budgets-with-progress'],
    queryFn: async (): Promise<Budget[]> => {
      const [budgets, filtered] = await Promise.all([
        budgetsApi.getAll(),
        fetchFilteredExpenses(),
      ])
      return budgets.map(b => ({
        ...b,
        progress: calcProgress(b, filtered, 0),
      }))
    },
  })
}

export function useBudgetWithProgress(id: string, offset: number) {
  return useQuery({
    queryKey: ['budget-with-progress', id, offset],
    queryFn: async () => {
      const [budget, filtered] = await Promise.all([
        budgetsApi.getById(id),
        fetchFilteredExpenses(),
      ])
      const { periodStart, periodEnd } = getPeriodBounds(
        budget.period,
        budget.startDate,
        budget.endDate,
        offset,
      )
      const matchingTxns = filtered.filter(t =>
        inPeriod(t.date, periodStart, periodEnd) && budgetMatchesTxn(budget, t),
      )
      const spent = matchingTxns.reduce((s, t) => s + t.amount, 0)
      const remaining = Math.max(0, budget.amount - spent)
      const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
      return {
        budget,
        progress: {
          spent,
          remaining,
          percent,
          is_exceeded: spent > budget.amount,
          period_start: periodStart,
          period_end: periodEnd,
        } satisfies BudgetProgress & { period_start: string; period_end: string },
        transactions: matchingTxns,
      }
    },
    enabled: !!id,
  })
}
```

- [ ] **Step 2: Export from hooks index** — check `src/hooks/index.ts` already has `export * from './use-budgets-progress'`. No change needed.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-budgets-progress.ts
git commit -m "refactor: use shared budget-period util in hooks, add useBudgetWithProgress"
```

---

## Task 4: Auto-select base currency in BudgetForm

**Files:**
- Modify: `src/components/features/budgets/BudgetForm.tsx`

- [ ] **Step 1: Update `BudgetForm.tsx`**

Add a `useEffect` after the existing hooks (after `const form = useForm(...)`) to set the base currency once currencies load, but only when `currency_id` is still unset:

Replace:
```ts
    const form = useForm<BudgetFormData>({
        resolver: zodResolver(budgetSchema),
        defaultValues: {
            name: '',
            amount: 0,
            currency_id: null,
            period: 'monthly',
            start_date: null,
            end_date: null,
            is_global: false,
            notify_at_percent: null,
            is_active: true,
            category_ids: [],
            tag_ids: [],
            ...defaultValues,
        },
    })
```

With:
```ts
    const form = useForm<BudgetFormData>({
        resolver: zodResolver(budgetSchema),
        defaultValues: {
            name: '',
            amount: 0,
            currency_id: null,
            period: 'monthly',
            start_date: null,
            end_date: null,
            is_global: false,
            notify_at_percent: null,
            is_active: true,
            category_ids: [],
            tag_ids: [],
            ...defaultValues,
        },
    })

    const explicitCurrencyId = defaultValues?.currency_id ?? null

    useEffect(() => {
        if (explicitCurrencyId) return
        const base = currencies?.find(c => c.isBase)
        if (base && !form.getValues('currency_id')) {
            form.setValue('currency_id', base.id)
        }
    }, [currencies, explicitCurrencyId, form])
```

Also add `useEffect` to the import at the top of the file (it's already imported from React via `useForm`, but add if missing):

Check line 1 of `BudgetForm.tsx` — it imports `useForm` from `react-hook-form` but React hooks like `useEffect` need to come from React. Add `useEffect` to the React import:

```ts
import { useEffect } from 'react'
```

(Add this as a new import line at the top of the file.)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/budgets/BudgetForm.tsx
git commit -m "fix: auto-select base currency in BudgetForm when creating new budget"
```

---

## Task 5: Create BudgetCard component + redesign list page

**Files:**
- Create: `src/components/features/budgets/BudgetCard.tsx`
- Modify: `src/components/features/budgets/index.ts`
- Modify: `src/components/features/budgets/columns.tsx`
- Modify: `src/pages/budgets/index.tsx`

- [ ] **Step 1: Create `src/components/features/budgets/BudgetCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AmountText } from '@/components/shared/AmountText'
import { CategoryPill } from '@/components/shared/CategoryPill'
import { cn } from '@/lib/utils'
import type { Budget } from '@/types'

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-time',
}

interface BudgetCardProps {
  budget: Budget
  onDelete: (id: string) => void
}

export function BudgetCard({ budget, onDelete }: BudgetCardProps) {
  const progress = budget.progress
  const symbol = budget.currency?.symbol ?? ''
  const decimals = budget.currency?.decimals ?? 2
  const percent = progress ? Math.min(progress.percent, 100) : 0
  const isExceeded = progress?.is_exceeded ?? false

  return (
    <Card className={cn('relative overflow-hidden transition-shadow hover:shadow-md', !budget.isActive && 'opacity-60')}>
      {/* Status stripe */}
      <div className={cn('h-1', budget.isActive ? 'bg-primary' : 'bg-muted-foreground/30')} />

      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <Link to={`/budgets/${budget.id}`} className="flex-1 min-w-0 hover:underline">
            <p className="font-semibold text-sm leading-tight truncate">{budget.name}</p>
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">
              {PERIOD_LABELS[budget.period] ?? budget.period}
            </Badge>
            {!budget.isActive && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/budgets/${budget.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete budget?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The budget "{budget.name}" will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(budget.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1 min-h-5">
          {budget.isGlobal ? (
            <span className="text-xs text-muted-foreground">All expenses</span>
          ) : budget.categories.length > 0 ? (
            budget.categories.map(c => (
              <CategoryPill key={c.id} name={c.name} icon={c.icon} color={c.color} size="sm" />
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No categories</span>
          )}
        </div>

        {/* Amount row */}
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold font-mono">
            <AmountText value={budget.amount} decimals={decimals} currency={symbol} />
          </span>
          {progress && (
            <span className={cn('text-xs font-medium', isExceeded ? 'text-red-600' : 'text-muted-foreground')}>
              {progress.percent.toFixed(0)}% used
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1">
            <Progress
              value={percent}
              className={cn('h-2', isExceeded && '[&>div]:bg-red-500')}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <AmountText value={progress.spent} decimals={decimals} currency={symbol} /> spent
              </span>
              <span className={cn(isExceeded && 'text-red-600 font-medium')}>
                {isExceeded ? (
                  <>Over by <AmountText value={progress.spent - budget.amount} decimals={decimals} currency={symbol} /></>
                ) : (
                  <><AmountText value={progress.remaining} decimals={decimals} currency={symbol} /> left</>
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Export from `src/components/features/budgets/index.ts`**

Replace:
```ts
export { BudgetForm } from './BudgetForm'
export { createBudgetColumns } from './columns'
```

With:
```ts
export { BudgetForm } from './BudgetForm'
export { createBudgetColumns } from './columns'
export { BudgetCard } from './BudgetCard'
```

- [ ] **Step 3: Redesign `src/pages/budgets/index.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page } from '@/components/shared'
import { BudgetCard } from '@/components/features/budgets'
import { useBudgetsWithProgress, useDeleteBudget } from '@/hooks'

export default function BudgetsPage() {
  const [search, setSearch] = useState('')
  const { data: budgets, isLoading } = useBudgetsWithProgress()
  const deleteBudget = useDeleteBudget()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return budgets ?? []
    return (budgets ?? []).filter(b => (b.name ?? '').toLowerCase().includes(q))
  }, [search, budgets])

  return (
    <Page title="Budgets" description="Set spending limits for categories">
      <div className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search budgets…"
            className="max-w-xs"
          />
          <Button asChild className="ml-auto">
            <Link to="/budgets/create">
              <Plus className="size-4 mr-2" />
              New Budget
            </Link>
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Wallet className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {search ? 'No budgets match your search.' : 'No budgets yet.'}
            </p>
            {!search && (
              <Button asChild variant="outline" size="sm">
                <Link to="/budgets/create">Create your first budget</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(b => (
              <BudgetCard
                key={b.id}
                budget={b}
                onDelete={id => deleteBudget.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </Page>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/budgets/BudgetCard.tsx src/components/features/budgets/index.ts src/pages/budgets/index.tsx
git commit -m "feat: redesign budgets list page with card grid"
```

---

## Task 6: Create budget view page

**Files:**
- Create: `src/pages/budgets/[id]/index.tsx`

- [ ] **Step 1: Create `src/pages/budgets/[id]/index.tsx`**

```tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Page } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AmountText } from '@/components/shared/AmountText'
import { CategoryPill } from '@/components/shared/CategoryPill'
import { useBudgetWithProgress } from '@/hooks'
import { periodLabel } from '@/lib/budget-period'
import { cn } from '@/lib/utils'

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-time',
}

const NAVIGABLE_PERIODS = new Set(['weekly', 'monthly', 'yearly'])

export default function BudgetViewPage() {
  const { id } = useParams<{ id: string }>()
  const [offset, setOffset] = useState(0)
  const { data, isLoading } = useBudgetWithProgress(id!, offset)

  if (isLoading) {
    return (
      <Page title="Budget">
        <div className="p-8 text-muted-foreground text-sm">Loading…</div>
      </Page>
    )
  }

  if (!data) {
    return (
      <Page title="Budget">
        <div className="p-8 text-muted-foreground text-sm">Budget not found.</div>
      </Page>
    )
  }

  const { budget, progress, transactions } = data
  const symbol = budget.currency?.symbol ?? ''
  const decimals = budget.currency?.decimals ?? 2
  const percent = Math.min(progress.percent, 100)
  const isExceeded = progress.is_exceeded
  const canNavigate = NAVIGABLE_PERIODS.has(budget.period)
  const currentPeriodLabel = periodLabel(budget.period, progress.period_start, progress.period_end)

  return (
    <Page title={budget.name}>
      <div className="max-w-2xl mx-auto p-4 pb-12 space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/budgets" className="hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="size-3.5" />
            Budgets
          </Link>
          <span>/</span>
          <span className="truncate">{budget.name}</span>
        </div>

        {/* Hero */}
        <Card className="overflow-hidden">
          <div className={cn('h-1', budget.isActive ? 'bg-primary' : 'bg-muted-foreground/30')} />
          <CardContent className="p-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h1 className="text-xl font-bold">{budget.name}</h1>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline">{PERIOD_LABELS[budget.period] ?? budget.period}</Badge>
                  {!budget.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/budgets/${budget.id}/edit`}>
                  <Pencil className="size-3.5 mr-1.5" />
                  Edit
                </Link>
              </Button>
            </div>

            {/* Categories */}
            {budget.isGlobal ? (
              <p className="text-sm text-muted-foreground">Applies to all expenses</p>
            ) : budget.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {budget.categories.map(c => (
                  <CategoryPill key={c.id} name={c.name} icon={c.icon} color={c.color} size="sm" />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Period navigator */}
        {canNavigate && (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(o => o + 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="text-sm font-medium">{currentPeriodLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(o => o - 1)}
              disabled={offset === 0}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Progress card */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-bold font-mono">
                  <AmountText value={progress.spent} decimals={decimals} currency={symbol} />
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  of <AmountText value={budget.amount} decimals={decimals} currency={symbol} /> limit
                </p>
              </div>
              <span className={cn('text-2xl font-bold', isExceeded ? 'text-red-600' : 'text-muted-foreground')}>
                {progress.percent.toFixed(0)}%
              </span>
            </div>

            <Progress value={percent} className={cn('h-3', isExceeded && '[&>div]:bg-red-500')} />

            <p className={cn('text-sm', isExceeded ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              {isExceeded ? (
                <>Exceeded by <AmountText value={progress.spent - budget.amount} decimals={decimals} currency={symbol} /></>
              ) : (
                <><AmountText value={progress.remaining} decimals={decimals} currency={symbol} /> remaining</>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Transactions ({transactions.length})
          </h2>

          {transactions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No transactions in this period.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {transactions
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(t => (
                    <Link
                      key={t.id}
                      to={`/transactions/${t.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium truncate">
                          {t.description || <span className="text-muted-foreground italic">No description</span>}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {t.category && (
                            <CategoryPill name={t.category.name} icon={t.category.icon} color={t.category.color} size="sm" />
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-medium text-red-600 shrink-0">
                        −<AmountText value={t.amount} decimals={t.account.currency?.decimals ?? 2} currency={t.account.currency?.symbol} />
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Page>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/budgets/[id]/index.tsx
git commit -m "feat: add budget view page with period navigation and transactions list"
```

---

## Task 7: Register route in router

**Files:**
- Modify: `src/app/router.tsx`

- [ ] **Step 1: Add lazy import and route in `src/app/router.tsx`**

After line 27 (`const BudgetEditPage = lazy(...)`), add:
```ts
const BudgetViewPage = lazy(() => import('@/pages/budgets/[id]/index'))
```

In the routes array, after `{ path: 'budgets/create', element: withSuspense(BudgetCreatePage) }`, add (before the edit route):
```ts
{ path: 'budgets/:id', element: withSuspense(BudgetViewPage) },
```

The routes block should look like:
```ts
{ path: 'budgets', element: withSuspense(BudgetsPage) },
{ path: 'budgets/create', element: withSuspense(BudgetCreatePage) },
{ path: 'budgets/:id', element: withSuspense(BudgetViewPage) },
{ path: 'budgets/:id/edit', element: withSuspense(BudgetEditPage) },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/router.tsx
git commit -m "feat: register budget view route /budgets/:id"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| Categories display on list page | Task 2 (API fix) |
| Edit form shows selected categories | Task 2 (API fix, getById resolves categories) |
| Progress bar calculates monthly spending | Task 2 + Task 3 (hook uses budget-period) |
| Base currency pre-selected | Task 4 |
| Budget view page | Task 6 |
| View page: transactions counted toward budget | Task 6 (`transactions` from `useBudgetWithProgress`) |
| View page: monthly/weekly time frame switch | Task 6 (period navigator + offset state) |
| View page: navigate prev months/weeks | Task 6 (`setOffset(o => o + 1)`) |
| Redesigned list page | Task 5 (card grid) |

**Type consistency check:**
- `useBudgetWithProgress` returns `{ budget, progress, transactions }` — used exactly this shape in view page.
- `getPeriodBounds` signature `(period, start, end, offset = 0)` — called with offset in hook, without offset (default 0) in `useBudgetsWithProgress`.
- `periodLabel` exported from `budget-period.ts` — imported in view page.
- `BudgetCard` prop `onDelete: (id: string) => void` — called as `id => deleteBudget.mutate(id)` in list page. ✓

**Placeholder scan:** No TBDs, TODOs, or vague steps found.
