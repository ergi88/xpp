# Budget View Category Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Apple-style segmented progress bar, per-category breakdown rows, and category filter chips to the budget view page.

**Architecture:** Extract `computeCategoryTotals` as a pure function in `src/lib/budget-period.ts` (testable). The view page imports it and uses `useMemo` to derive segments, filter state drives which transactions are shown and which bar segments dim.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/budget-period.ts` | Add `computeCategoryTotals(transactions)` export |
| `src/lib/__tests__/budget-period.test.ts` | Add tests for `computeCategoryTotals` |
| `src/pages/budgets/[id]/index.tsx` | Replace progress bar + add breakdown + filter chips |

---

## Task 1: Add `computeCategoryTotals` to budget-period utility

**Files:**
- Modify: `src/lib/budget-period.ts`
- Modify: `src/lib/__tests__/budget-period.test.ts`

- [ ] **Step 1: Add the function to `src/lib/budget-period.ts`**

Append at the end of the file (after `periodLabel`):

```ts
export const UNCATEGORIZED_COLOR = '#94a3b8'

export interface CategoryTotal {
  category: {
    id: string
    name: string
    color: string
    icon: string
    type: 'income' | 'expense'
  }
  amount: number
  segPct: number
}

export function computeCategoryTotals(
  transactions: Transaction[],
  budgetAmount: number,
): CategoryTotal[] {
  const map = new Map<string, { category: CategoryTotal['category']; amount: number }>()

  for (const t of transactions) {
    const catId = t.category?.id ?? '__none__'
    const cat = t.category ?? {
      id: '__none__',
      name: 'Uncategorized',
      color: UNCATEGORIZED_COLOR,
      icon: 'circle',
      type: 'expense' as const,
    }
    const prev = map.get(catId) ?? { category: cat, amount: 0 }
    prev.amount += t.amount
    map.set(catId, prev)
  }

  const sorted = [...map.values()].sort((a, b) => b.amount - a.amount)

  let usedPct = 0
  return sorted.map(entry => {
    const raw = budgetAmount > 0 ? (entry.amount / budgetAmount) * 100 : 0
    const segPct = Math.min(raw, Math.max(0, 100 - usedPct))
    usedPct += segPct
    return { ...entry, segPct }
  })
}
```

- [ ] **Step 2: Add tests to `src/lib/__tests__/budget-period.test.ts`**

Append after the existing `periodLabel` describe block:

```ts
describe('computeCategoryTotals', () => {
  const makeTxn = (id: string, amount: number, categoryId?: string, color = '#ff0000') =>
    ({
      id,
      amount,
      date: '2026-05-01',
      account: { id: 'a1' } as Transaction['account'],
      items: [],
      tags: [],
      isExcluded: false,
      isOneTime: false,
      parentId: null,
      debtId: null,
      linkedTransactionId: null,
      recurringId: null,
      type: 'expense',
      category: categoryId
        ? { id: categoryId, name: categoryId, color, icon: 'x', type: 'expense' as const }
        : null,
    }) as unknown as Transaction

  it('groups transactions by category and sorts by amount desc', () => {
    const txns = [
      makeTxn('t1', 100, 'food'),
      makeTxn('t2', 200, 'transport'),
      makeTxn('t3', 50, 'food'),
    ]
    const result = computeCategoryTotals(txns, 1000)
    expect(result[0].category.id).toBe('transport')
    expect(result[0].amount).toBe(200)
    expect(result[1].category.id).toBe('food')
    expect(result[1].amount).toBe(150)
  })

  it('groups uncategorized transactions under __none__', () => {
    const txns = [makeTxn('t1', 80, undefined)]
    const result = computeCategoryTotals(txns, 1000)
    expect(result[0].category.id).toBe('__none__')
    expect(result[0].category.name).toBe('Uncategorized')
    expect(result[0].category.color).toBe(UNCATEGORIZED_COLOR)
  })

  it('computes segPct as percentage of budgetAmount', () => {
    const txns = [makeTxn('t1', 250, 'food')]
    const result = computeCategoryTotals(txns, 1000)
    expect(result[0].segPct).toBe(25)
  })

  it('clamps total segPct at 100 when budget is exceeded', () => {
    const txns = [
      makeTxn('t1', 600, 'food'),
      makeTxn('t2', 600, 'transport'),
    ]
    const result = computeCategoryTotals(txns, 1000)
    const total = result.reduce((s, r) => s + r.segPct, 0)
    expect(total).toBeLessThanOrEqual(100)
    expect(result[0].segPct).toBe(60) // food 600/1000
    expect(result[1].segPct).toBe(40) // transport capped at remaining 40%
  })

  it('returns empty array for empty transactions', () => {
    expect(computeCategoryTotals([], 1000)).toHaveLength(0)
  })

  it('handles budgetAmount of 0 without dividing by zero', () => {
    const txns = [makeTxn('t1', 100, 'food')]
    const result = computeCategoryTotals(txns, 0)
    expect(result[0].segPct).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/__tests__/budget-period.test.ts
```

Expected: all tests pass (18 existing + 6 new = 24 total).

- [ ] **Step 4: Commit**

```bash
git add src/lib/budget-period.ts src/lib/__tests__/budget-period.test.ts
git commit -m "feat: add computeCategoryTotals to budget-period utility"
```

---

## Task 2: Replace progress section + add filter chips in BudgetViewPage

**Files:**
- Modify: `src/pages/budgets/[id]/index.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Page } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AmountText } from '@/components/shared/AmountText'
import { CategoryPill } from '@/components/shared/CategoryPill'
import { useBudgetWithProgress } from '@/hooks'
import { computeCategoryTotals, periodLabel } from '@/lib/budget-period'
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const { data, isLoading } = useBudgetWithProgress(id!, offset)

  useEffect(() => {
    setSelectedCategoryId(null)
  }, [offset])

  const categoryTotals = useMemo(
    () => computeCategoryTotals(data?.transactions ?? [], data?.budget.amount ?? 0),
    [data],
  )

  const visibleTransactions = useMemo(() => {
    if (!data) return []
    if (!selectedCategoryId) return data.transactions
    return data.transactions.filter(t =>
      selectedCategoryId === '__none__' ? !t.category : t.category?.id === selectedCategoryId,
    )
  }, [data, selectedCategoryId])

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

  const { budget, progress } = data
  const symbol = budget.currency?.symbol ?? ''
  const decimals = budget.currency?.decimals ?? 2
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
            <Button variant="ghost" size="sm" onClick={() => setOffset(o => o + 1)} className="gap-1.5">
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

            {/* Amounts header */}
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

            {/* Segmented bar (Apple storage style) */}
            <div className={cn('flex h-4 w-full overflow-hidden rounded-full bg-muted', isExceeded && 'ring-1 ring-red-500')}>
              {categoryTotals.map(s => (
                <div
                  key={s.category.id}
                  style={{ width: `${s.segPct}%`, backgroundColor: s.category.color }}
                  className={cn(
                    'h-full transition-opacity duration-200',
                    selectedCategoryId && selectedCategoryId !== s.category.id ? 'opacity-30' : 'opacity-100',
                  )}
                />
              ))}
            </div>

            {/* Category breakdown rows */}
            <div className="space-y-1.5">
              {categoryTotals.map(entry => {
                const pct = budget.amount > 0 ? (entry.amount / budget.amount) * 100 : 0
                return (
                  <div key={entry.category.id} className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.category.color }}
                    />
                    <span className="text-sm flex-1 truncate">{entry.category.name}</span>
                    <span className="font-mono text-sm">
                      <AmountText value={entry.amount} decimals={decimals} currency={symbol} />
                    </span>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                )
              })}

              {/* Remaining / exceeded summary row */}
              <div className="flex items-center gap-2 pt-1.5 border-t border-border">
                <span className="size-2.5 shrink-0" />
                <span className={cn('text-sm flex-1', isExceeded ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                  {isExceeded ? 'Exceeded by' : 'Remaining'}
                </span>
                <span className={cn('font-mono text-sm', isExceeded ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                  <AmountText
                    value={isExceeded ? progress.spent - budget.amount : progress.remaining}
                    decimals={decimals}
                    currency={symbol}
                  />
                </span>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {!isExceeded && `${Math.max(0, 100 - Math.min(progress.percent, 100)).toFixed(0)}%`}
                </span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Transactions */}
        <div className="space-y-2">

          {/* Category filter chips — only when >1 category */}
          {categoryTotals.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  selectedCategoryId === null
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                All
              </button>
              {categoryTotals.map(entry => (
                <button
                  key={entry.category.id}
                  onClick={() =>
                    setSelectedCategoryId(
                      selectedCategoryId === entry.category.id ? null : entry.category.id,
                    )
                  }
                  style={
                    selectedCategoryId === entry.category.id
                      ? { backgroundColor: entry.category.color }
                      : undefined
                  }
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    selectedCategoryId === entry.category.id
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {entry.category.name}
                </button>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Transactions ({visibleTransactions.length})
          </h2>

          {visibleTransactions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {selectedCategoryId ? 'No transactions for this category.' : 'No transactions in this period.'}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {visibleTransactions
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

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (24+ total, no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/pages/budgets/[id]/index.tsx
git commit -m "feat: add segmented progress bar, category breakdown, and filter chips to budget view"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| Segmented bar with category colors | Task 2 (`categoryTotals.map` → colored divs) |
| Apple-style: `rounded-full` container + `overflow-hidden` | Task 2 |
| Segments dim when another category selected | Task 2 (`opacity-30` when `selectedCategoryId !== s.category.id`) |
| `ring-red-500` on exceeded | Task 2 |
| Category breakdown rows with dot, name, amount, % | Task 2 |
| Remaining / exceeded summary row with border-t | Task 2 |
| Uncategorized bucket (`__none__`) | Task 1 (`computeCategoryTotals`) + Task 2 |
| Category filter chips — All + per-category | Task 2 |
| Active chip uses `category.color` as bg | Task 2 (inline style) |
| Clicking active chip deselects (toggle) | Task 2 (`selectedCategoryId === entry.category.id ? null : entry.category.id`) |
| Filter resets on period navigation | Task 2 (`useEffect` on `offset`) |
| Transaction count reflects filter | Task 2 (`visibleTransactions.length`) |
| Empty state message differs when filtered | Task 2 ("No transactions for this category.") |
| `computeCategoryTotals` tested | Task 1 (6 tests) |

**No placeholders found.**

**Type consistency:** `CategoryTotal.category` shape defined in Task 1, used in Task 2 map. `computeCategoryTotals` signature `(transactions: Transaction[], budgetAmount: number): CategoryTotal[]` — called with `(data?.transactions ?? [], data?.budget.amount ?? 0)` in Task 2. ✓
