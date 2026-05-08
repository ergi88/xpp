# Transactions Date Navigation & Account Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified date navigation block (month/day drill-down), multi-select account filter pills, `created_at` sort option, and fix the mobile x-scroll on the transactions page.

**Architecture:** Pure helper functions handle date math and formatting in isolation; a dedicated `DateNavBlock` component renders the nav UI; the page wires everything together via nuqs URL state. The API layer gains `account_ids` multi-filter and `created_at` sort without breaking existing callers.

**Tech Stack:** React, TypeScript, nuqs (URL state), TanStack Query, Tailwind CSS, lucide-react, shadcn/ui (Button, Badge)

> **Note:** No test framework is configured in this project. TDD steps are omitted.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/transactions.ts` | Modify | Add `account_ids` to filters, `transfer`+`decimals` to summary |
| `src/api/transactions.ts` | Modify | `account_ids` filter, `created_at` sort, `transfer`+`decimals` in summary |
| `src/pages/transactions/dateNavHelpers.ts` | Create | Pure date math + label helpers (no React) |
| `src/pages/transactions/DateNavBlock.tsx` | Create | Navigation UI: arrows + 3-row center |
| `src/pages/transactions/index.tsx` | Modify | New params, account pills row, responsive fix, remove date inputs |

---

## Task 1: Extend TransactionFilters and TransactionSummary types

**Files:**
- Modify: `src/types/transactions.ts`

- [ ] **Step 1: Add `account_ids` to `TransactionFilters` and `transfer` + `decimals` to `TransactionSummary`**

Replace the two interfaces in `src/types/transactions.ts`:

```ts
export interface TransactionFilters {
    type?: 'income' | 'expense' | 'transfer'
    account_id?: string
    account_ids?: string[]
    category_id?: string
    category_ids?: string[]
    tag_ids?: string[]
    start_date?: string
    end_date?: string
    sort_by?: 'date' | 'amount' | 'created_at'
    sort_direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
}

export interface TransactionSummary {
    income: number
    expense: number
    transfer: number
    balance: number
    transactions_count: number
    currency: string
    decimals: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/transactions.ts
git commit -m "feat(types): add account_ids filter, transfer and decimals to TransactionSummary"
```

---

## Task 2: Update applyFilters — account_ids + created_at sort

**Files:**
- Modify: `src/api/transactions.ts:62-82`

- [ ] **Step 1: Replace the `applyFilters` function**

Replace the entire `applyFilters` function (lines 62–82) in `src/api/transactions.ts`:

```ts
function applyFilters(txns: Transaction[], filters: TransactionFilters): Transaction[] {
  let result = txns
  if (filters.type) result = result.filter(t => t.type === filters.type)
  if (filters.account_id) result = result.filter(t => t.account?.id === String(filters.account_id))
  if (filters.account_ids?.length) result = result.filter(t => filters.account_ids!.includes(t.account?.id))
  if (filters.category_id) result = result.filter(t => t.category?.id === String(filters.category_id))
  if (filters.category_ids?.length) result = result.filter(t => t.category && filters.category_ids!.map(String).includes(t.category.id))
  if (filters.tag_ids?.length) result = result.filter(t => t.tags.some(tag => filters.tag_ids!.map(String).includes(tag.id)))
  if (filters.start_date) result = result.filter(t => t.date >= filters.start_date!)
  if (filters.end_date) result = result.filter(t => t.date <= filters.end_date!)
  if (filters.sort_by) {
    const dir = filters.sort_direction === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      const va = filters.sort_by === 'amount' ? a.amount
               : filters.sort_by === 'created_at' ? (a.createdAt ?? '')
               : a.date
      const vb = filters.sort_by === 'amount' ? b.amount
               : filters.sort_by === 'created_at' ? (b.createdAt ?? '')
               : b.date
      return va < vb ? -dir : va > vb ? dir : 0
    })
  } else {
    result = [...result].sort((a, b) => b.date.localeCompare(a.date))
  }
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/transactions.ts
git commit -m "feat(api): add account_ids filter and created_at sort to applyFilters"
```

---

## Task 3: Add transfer + decimals to summary computation

**Files:**
- Modify: `src/api/transactions.ts` (summary block inside `getAll`, and `getSummary`)

- [ ] **Step 1: Update the summary block inside `getAll`**

Find this block in `src/api/transactions.ts` (around line 109–122):

```ts
    let summary: TransactionSummary | undefined
    if (filters?.with_summary) {
      const { baseCurrency, currency } = await getBaseCurrencyMeta()
      const aggregateTxns = txns.filter((transaction) =>
        isTransactionIncludedInBaseAggregates(transaction, baseCurrency?.id),
      )
      summary = {
        income: aggregateTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: aggregateTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        balance: 0,
        transactions_count: aggregateTxns.length,
        currency,
      }
      summary.balance = summary.income - summary.expense
    }
```

Replace it with:

```ts
    let summary: TransactionSummary | undefined
    if (filters?.with_summary) {
      const { baseCurrency, currency } = await getBaseCurrencyMeta()
      const aggregateTxns = txns.filter((transaction) =>
        isTransactionIncludedInBaseAggregates(transaction, baseCurrency?.id),
      )
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

- [ ] **Step 2: Commit**

```bash
git add src/api/transactions.ts
git commit -m "feat(api): add transfer total and decimals to TransactionSummary"
```

---

## Task 4: Create date nav helper functions

**Files:**
- Create: `src/pages/transactions/dateNavHelpers.ts`

- [ ] **Step 1: Create the file with all helper functions**

```ts
import type { Account } from '@/types/accounts'
import type { TransactionSummary } from '@/types/transactions'

export function firstDayOfCurrentMonth(): string {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

export function getDateRange(navMode: 'month' | 'day', navDate: string): { start_date: string; end_date: string } {
    if (navMode === 'day') return { start_date: navDate, end_date: navDate }
    const d = new Date(navDate + 'T00:00:00')
    const year = d.getFullYear()
    const month = d.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${year}-${pad(month + 1)}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${pad(month + 1)}-${pad(lastDay)}`
    return { start_date: start, end_date: end }
}

export function stepMonth(navDate: string, dir: 1 | -1): string {
    const d = new Date(navDate + 'T00:00:00')
    d.setMonth(d.getMonth() + dir)
    d.setDate(1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

export function stepDay(navDate: string, dir: 1 | -1): string {
    const d = new Date(navDate + 'T00:00:00')
    d.setDate(d.getDate() + dir)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatPeriod(navMode: 'month' | 'day', navDate: string): string {
    const d = new Date(navDate + 'T00:00:00')
    if (navMode === 'month') {
        return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getNavLabel(type: string | null | undefined): string {
    if (type === 'income') return 'Total Income'
    if (type === 'expense') return 'Total Expense'
    if (type === 'transfer') return 'Total Transfers'
    return 'Net Balance'
}

export function getNavValue(summary: TransactionSummary | undefined, type: string | null | undefined): number {
    if (!summary) return 0
    if (type === 'income') return summary.income
    if (type === 'expense') return summary.expense
    if (type === 'transfer') return summary.transfer
    return summary.income - summary.expense
}

export function getAccountLabel(accountIds: string[], accounts: Account[]): string {
    if (accountIds.length === 0) return 'All Accounts'
    const selected = accounts.filter(a => accountIds.includes(a.id))
    if (selected.length === 0) return 'All Accounts'
    if (selected.length <= 2) return selected.map(a => a.name).join(', ')
    return `${selected.length} Accounts`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/dateNavHelpers.ts
git commit -m "feat(transactions): add date navigation helper functions"
```

---

## Task 5: Create DateNavBlock component

**Files:**
- Create: `src/pages/transactions/DateNavBlock.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AmountText } from '@/components/shared/AmountText'
import type { TransactionSummary } from '@/types/transactions'
import type { Account } from '@/types/accounts'
import {
    formatPeriod,
    getNavLabel,
    getNavValue,
    getAccountLabel,
} from './dateNavHelpers'

interface DateNavBlockProps {
    navMode: 'month' | 'day'
    navDate: string
    type: string | null | undefined
    summary?: TransactionSummary
    accountIds: string[]
    accounts: Account[]
    onPrev: () => void
    onNext: () => void
    onToggleMode: () => void
}

export function DateNavBlock({
    navMode,
    navDate,
    type,
    summary,
    accountIds,
    accounts,
    onPrev,
    onNext,
    onToggleMode,
}: DateNavBlockProps) {
    const period = formatPeriod(navMode, navDate)
    const label = getNavLabel(type)
    const value = getNavValue(summary, type)
    const accountLabel = getAccountLabel(accountIds, accounts)
    const currency = summary?.currency ?? ''
    const decimals = summary?.decimals ?? 2

    return (
        <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={onPrev} className="shrink-0">
                <ChevronLeft className="size-4" />
            </Button>
            <button
                onClick={onToggleMode}
                className="flex flex-col items-center gap-0.5 flex-1 py-2 cursor-pointer select-none rounded-md hover:bg-muted/50 transition-colors"
            >
                <span className="text-xs text-muted-foreground font-medium">
                    {label}: {period}
                </span>
                <AmountText
                    value={value}
                    decimals={decimals}
                    currency={currency}
                    signDisplay={!type ? 'always' : 'auto'}
                    className="text-2xl font-bold"
                />
                <span className="text-xs text-muted-foreground">{accountLabel}</span>
            </button>
            <Button variant="outline" size="icon" onClick={onNext} className="shrink-0">
                <ChevronRight className="size-4" />
            </Button>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/DateNavBlock.tsx
git commit -m "feat(transactions): add DateNavBlock component"
```

---

## Task 6: Update page — params, helpers, sort options

**Files:**
- Modify: `src/pages/transactions/index.tsx`

- [ ] **Step 1: Update imports**

At the top of `src/pages/transactions/index.tsx`, replace the existing import block with:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryStates, parseAsInteger, parseAsString, parseAsArrayOf, parseAsStringLiteral } from 'nuqs'
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Filter, ArrowUpDown, X } from 'lucide-react'
import { Row } from '@tanstack/react-table'
import { Page, PageHeader, DataTable, ServerPagination } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { createTransactionColumns } from '@/components/features/transactions'
import { AmountText } from '@/components/shared/AmountText'
import { useTransactions, useDeleteTransaction, useDuplicateTransaction, useCategories, useTags, useTransactionSummary } from '@/hooks'
import { useAccounts } from '@/hooks'
import { TransactionType, Transaction } from '@/types'
import { cn } from '@/lib/utils'
import { DateNavBlock } from './DateNavBlock'
import {
    firstDayOfCurrentMonth,
    getDateRange,
    stepMonth,
    stepDay,
} from './dateNavHelpers'
```

- [ ] **Step 2: Update SORT_OPTIONS**

Replace the `SORT_OPTIONS` constant:

```ts
const SORT_OPTIONS = [
    { value: 'date:desc', label: 'Date (Newest)' },
    { value: 'date:asc', label: 'Date (Oldest)' },
    { value: 'amount:desc', label: 'Amount (High to Low)' },
    { value: 'amount:asc', label: 'Amount (Low to High)' },
    { value: 'created_at:desc', label: 'Date Added (Newest)' },
    { value: 'created_at:asc', label: 'Date Added (Oldest)' },
]
```

- [ ] **Step 3: Update transactionSearchParams**

Replace `transactionSearchParams`:

```ts
const transactionSearchParams = {
    type: parseAsStringLiteral(['income', 'expense', 'transfer'] as const),
    sortBy: parseAsStringLiteral(['date', 'amount', 'created_at'] as const).withDefault('date'),
    sortDir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault('desc'),
    page: parseAsInteger.withDefault(1),
    categoryIds: parseAsArrayOf(parseAsString).withDefault([]),
    tagIds: parseAsArrayOf(parseAsString).withDefault([]),
    navMode: parseAsStringLiteral(['month', 'day'] as const).withDefault('month'),
    navDate: parseAsString.withDefault(firstDayOfCurrentMonth()),
    accountIds: parseAsArrayOf(parseAsString).withDefault([]),
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/transactions/index.tsx
git commit -m "feat(transactions): update sort options and query params for nav + account filter"
```

---

## Task 7: Wire page — filters, nav handlers, account pills, responsive fix

**Files:**
- Modify: `src/pages/transactions/index.tsx`

- [ ] **Step 1: Update component body — hooks and derived state**

Replace the body of `TransactionsPage` from the `const [params, setParams]` line through the end of the `filters` object:

```tsx
export default function TransactionsPage() {
    const [params, setParams] = useQueryStates(transactionSearchParams)
    const [filtersOpen, setFiltersOpen] = useState(false)

    const dateRange = getDateRange(params.navMode, params.navDate)

    const filters = {
        per_page: 20,
        page: params.page,
        type: params.type ?? undefined,
        sort_by: params.sortBy,
        sort_direction: params.sortDir,
        category_ids: params.categoryIds.length > 0 ? params.categoryIds : undefined,
        tag_ids: params.tagIds.length > 0 ? params.tagIds : undefined,
        account_ids: params.accountIds.length > 0 ? params.accountIds : undefined,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
    }

    const summaryFilters = {
        type: params.type ?? undefined,
        account_ids: params.accountIds.length > 0 ? params.accountIds : undefined,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
    }

    const { data, isLoading } = useTransactions(filters)
    const { data: summary } = useTransactionSummary(summaryFilters)
    const deleteTransaction = useDeleteTransaction()
    const duplicateTransaction = useDuplicateTransaction()
    const { data: categories } = useCategories()
    const { data: tags } = useTags()
    const { data: accountsData } = useAccounts({ active: true })
    const accounts = accountsData ?? []
    const isReadOnly = false
```

- [ ] **Step 2: Add nav handlers and account toggle**

Add these handler functions after `isReadOnly = false`:

```tsx
    const columns = createTransactionColumns(
        (id) => deleteTransaction.mutate(id),
        (id) => duplicateTransaction.mutate(id),
        isReadOnly
    )

    const transactions = data?.data ?? []
    const meta = data?.meta

    const activeFiltersCount = [
        params.categoryIds.length > 0,
        params.tagIds.length > 0,
    ].filter(Boolean).length

    const clearFilters = () => {
        setParams({
            categoryIds: null,
            tagIds: null,
            page: 1,
        })
    }

    const toggleCategory = (id: string) => {
        const current = params.categoryIds
        const newIds = current.includes(id)
            ? current.filter(c => c !== id)
            : [...current, id]
        setParams({ categoryIds: newIds.length ? newIds : null, page: 1 })
    }

    const toggleTag = (id: string) => {
        const current = params.tagIds
        const newIds = current.includes(id)
            ? current.filter(t => t !== id)
            : [...current, id]
        setParams({ tagIds: newIds.length ? newIds : null, page: 1 })
    }

    const toggleAccount = (id: string) => {
        const current = params.accountIds
        const newIds = current.includes(id)
            ? current.filter(a => a !== id)
            : [...current, id]
        setParams({ accountIds: newIds.length ? newIds : null, page: 1 })
    }

    const handleNavPrev = () => {
        const newDate = params.navMode === 'month'
            ? stepMonth(params.navDate, -1)
            : stepDay(params.navDate, -1)
        setParams({ navDate: newDate, page: 1 })
    }

    const handleNavNext = () => {
        const newDate = params.navMode === 'month'
            ? stepMonth(params.navDate, 1)
            : stepDay(params.navDate, 1)
        setParams({ navDate: newDate, page: 1 })
    }

    const handleNavToggleMode = () => {
        if (params.navMode === 'month') {
            // drill down: go to today if in current month, else 1st of current navDate month
            const now = new Date()
            const navD = new Date(params.navDate + 'T00:00:00')
            const isCurrentMonth = now.getFullYear() === navD.getFullYear() && now.getMonth() === navD.getMonth()
            const pad = (n: number) => String(n).padStart(2, '0')
            const dayDate = isCurrentMonth
                ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
                : params.navDate
            setParams({ navMode: 'day', navDate: dayDate, page: 1 })
        } else {
            // pop back to month: keep same month, reset to 1st
            const d = new Date(params.navDate + 'T00:00:00')
            const pad = (n: number) => String(n).padStart(2, '0')
            const monthDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
            setParams({ navMode: 'month', navDate: monthDate, page: 1 })
        }
    }

    const filteredCategories = categories?.filter(c =>
        !params.type || params.type === 'transfer' || c.type === params.type
    ) ?? []
```

- [ ] **Step 3: Replace the JSX return**

Replace the entire `return (...)` block:

```tsx
    return (
        <Page title="Transactions">
            <PageHeader
                title="Transactions"
                description="Track your income, expenses and transfers"
                createLink={params.type ? `/transactions/create?type=${params.type}` : '/transactions/create'}
                createLabel="New Transaction"
            />

            {/* Date Navigation */}
            <DateNavBlock
                navMode={params.navMode}
                navDate={params.navDate}
                type={params.type}
                summary={summary}
                accountIds={params.accountIds}
                accounts={accounts}
                onPrev={handleNavPrev}
                onNext={handleNavNext}
                onToggleMode={handleNavToggleMode}
            />

            {/* Type Filter Row */}
            <div className="flex flex-wrap gap-2 mb-2">
                {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
                    <Button
                        key={label}
                        variant={params.type === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setParams({ type: value, page: 1 })}
                    >
                        {Icon && <Icon className="size-4 mr-1" />}
                        {label}
                    </Button>
                ))}
            </div>

            {/* Account Filter Row */}
            {accounts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                        variant={params.accountIds.length === 0 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setParams({ accountIds: null, page: 1 })}
                    >
                        All Accounts
                    </Button>
                    {accounts.map((account) => (
                        <Button
                            key={account.id}
                            variant={params.accountIds.includes(account.id) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleAccount(account.id)}
                        >
                            {account.name}
                        </Button>
                    ))}
                </div>
            )}

            {/* Sort + Advanced Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                        <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="size-4 mr-2" />
                                    Filters
                                    {activeFiltersCount > 0 && (
                                        <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                                            {activeFiltersCount}
                                        </Badge>
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="size-4 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
                        <CollapsibleContent className="mt-4 space-y-4">
                            <Card>
                                <CardContent className="pt-4 space-y-4">
                                    {/* Categories */}
                                    {filteredCategories.length > 0 && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Categories</label>
                                            <div className="flex flex-wrap gap-2">
                                                {filteredCategories.map((category) => {
                                                    const isSelected = params.categoryIds.includes(category.id)
                                                    return (
                                                        <Badge
                                                            key={category.id}
                                                            variant={isSelected ? 'default' : 'outline'}
                                                            className={cn(
                                                                'cursor-pointer transition-colors',
                                                                isSelected ? 'hover:bg-primary/80' : 'hover:bg-muted'
                                                            )}
                                                            onClick={() => toggleCategory(category.id)}
                                                        >
                                                            {category.icon} {category.name}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {tags && tags.length > 0 && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Tags</label>
                                            <div className="flex flex-wrap gap-2">
                                                {tags.map((tag) => {
                                                    const isSelected = params.tagIds.includes(tag.id)
                                                    return (
                                                        <Badge
                                                            key={tag.id}
                                                            variant={isSelected ? 'default' : 'outline'}
                                                            className={cn(
                                                                'cursor-pointer transition-colors',
                                                                isSelected ? 'hover:bg-primary/80' : 'hover:bg-muted'
                                                            )}
                                                            onClick={() => toggleTag(tag.id)}
                                                        >
                                                            #{tag.name}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </CollapsibleContent>
                    </Collapsible>
                </div>

                <Select
                    value={`${params.sortBy}:${params.sortDir}`}
                    onValueChange={(val) => {
                        const parts = val.split(':')
                        const sortDir = parts[parts.length - 1] as 'asc' | 'desc'
                        const sortBy = parts.slice(0, -1).join(':') as 'date' | 'amount' | 'created_at'
                        setParams({ sortBy, sortDir, page: 1 })
                    }}
                >
                    <SelectTrigger className="w-[180px] h-9">
                        <ArrowUpDown className="size-4 mr-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                data={transactions}
                columns={columns}
                isLoading={isLoading}
                emptyTitle="No transactions found"
                emptyDescription="Create your first transaction to start tracking"
                emptyAction={
                    <Button asChild>
                        <Link to={params.type ? `/transactions/create?type=${params.type}` : '/transactions/create'}>
                            <Plus className="size-4" />
                            New Transaction
                        </Link>
                    </Button>
                }
                renderSubComponent={TransactionItems}
                getRowCanExpand={(row) => (row.original.itemsCount ?? row.original.items?.length ?? 0) > 1}
                manualPagination
            />

            {meta && (
                <ServerPagination
                    meta={meta}
                    onPageChange={(page) => setParams({ page })}
                    infoLabel="transactions"
                />
            )}
        </Page>
    )
}
```

- [ ] **Step 4: Fix sortBy split for `created_at` values**

The `onValueChange` for the sort Select splits on `:`. The value `created_at:desc` splits into `['created_at', 'desc']` — the code above (`parts.slice(0, -1).join(':')`) handles this correctly since it joins all but the last part.

Verify by tracing: `'created_at:desc'.split(':')` → `['created_at', 'desc']`, `parts.slice(0,-1).join(':')` → `'created_at'`. ✓

- [ ] **Step 5: Commit**

```bash
git add src/pages/transactions/index.tsx
git commit -m "feat(transactions): add date nav block, account filter pills, responsive filter rows"
```

---

## Task 8: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify checklist**

Open the transactions page and confirm:

1. Nav block renders with arrows + 3-row center (label, amount, account label)
2. `←` / `→` navigate months correctly; month label and date range updates
3. Clicking center drills into day mode; clicking again pops back to month
4. Account pills render; selecting multiple accounts filters transactions and updates row 3 in nav center
5. Type filter pills (All/Income/Expense/Transfer) still work; nav center label updates accordingly
6. Net Balance (type=null) shows signed value (positive = green, negative = red if applicable)
7. Filters collapsible shows only Categories + Tags (no date inputs)
8. Sort dropdown includes `Date Added (Newest)` / `Date Added (Oldest)` options
9. On mobile (resize browser to 375px): type pills wrap, account pills wrap, no x-scroll
10. URL params update correctly for all interactions
