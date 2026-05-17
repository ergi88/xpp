# Transactions Overhaul — Phase 3: Split Transactions + Items Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users split a transaction into multiple category-attribution children (with optional debt-link XOR category), unify the legacy `items` model with the new split-child model, and surface a Split editor on the view page. Categorization surfaces in reports/budgets read child amounts when a parent has children.

**Architecture:** Children are stored as additional rows in the existing `transactions` sheet with `parent_id` set to the parent's id. Each child duplicates the parent's `account_id`, `date`, `type` for sheet-row sanity but the parent is the source of truth. Parents keep their account balance hit; children with `debt_id` apply a debt-balance side-effect. The read path loads parents and attaches their children via a single `getAll` pass that groups by `parent_id`. `expandSplitChildrenForCategoryView` is upgraded from no-op to actually expand parents into children when children exist.

**Tech Stack:** React 19, TypeScript, vite, @tanstack/react-query, react-hook-form + zod, vitest, tailwind.

**Source spec:** [`docs/superpowers/specs/2026-05-11-transactions-debts-recurring-overhaul-design.md`](../specs/2026-05-11-transactions-debts-recurring-overhaul-design.md), §4.2, §5.1, §8, §9.

**Phase 1+2 status:** Complete. Schema columns persist; filter helpers work; flags drive reports/budgets/dashboard.

**Commit discipline:** Each task ends with a commit. Conventional `feat:` / `refactor:` / `test:`. Trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## File structure (Phase 3)

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/types/transactions.ts` | Add `children?: Transaction[]` to `Transaction`; drop legacy `items` / `TransactionItem` / `itemsCount` (or mark deprecated) |
| Modify | `src/schemas/transactions.ts` | Add `splitChildSchema`; extend `transactionSchema` with `children?` array + XOR + sum refinements |
| Modify | `src/api/transactions.ts` | `toTransaction` groups children under parents; `create/update/delete` handle a `children` array |
| Modify | `src/api/transaction-effects.ts` | Already handles `parentId` + `debtId` cases (Phase 1) — no change |
| Modify | `src/lib/transaction-filters.ts` | Upgrade `expandSplitChildrenForCategoryView` to actually expand |
| Modify | `src/lib/__tests__/transaction-filters.test.ts` | Tests for the new expansion behavior |
| Create | `src/components/features/transactions/SplitEditor.tsx` | Inline editor: table of children, sum-validation, add/remove rows, save/unsplit |
| Modify | `src/pages/transactions/[id]/index.tsx` | Render SplitEditor when parent has children OR user clicks "Split this transaction" |
| Modify | `src/hooks/use-transactions.ts` | Add `useSplitTransaction`, `useUnsplitTransaction` mutation hooks |
| Modify | `src/components/features/transactions/TransactionForm.tsx` | Drop the legacy items table — items unification means items live as children now, edited via SplitEditor on view page |
| Modify | `src/pages/transactions/index.tsx` | List row: parent with children shows "split N ways" badge; click expands to show children inline (DataTable subcomponent already exists) |

---

## Task 1: Extend `Transaction` type with `children`, deprecate `items`

**Files:**
- Modify: `src/types/transactions.ts`

The legacy `items` field is always `[]` in `toTransaction` (Phase 1). Phase 3 introduces real per-child storage. Cleanest path: replace `items: TransactionItem[]` with `children?: Transaction[]` (children are themselves transactions with `parentId` set). Keep `itemsCount` as the count of children for back-compat with `src/components/features/transactions/columns.tsx:46` which reads `itemsCount`.

- [ ] **Step 1: Replace the file contents**

Open `src/types/transactions.ts`. Replace:

```ts
import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction extends BaseEntity {
    type: TransactionType
    amount: number
    toAmount?: number
    exchangeRate?: number
    description?: string
    date: string
    account: Account
    toAccount?: Account
    category?: Category
    children?: Transaction[]
    childrenCount?: number
    tags: Tag[]
    // Phase 1 fields:
    isExcluded: boolean
    isOneTime: boolean
    parentId: string | null
    debtId: string | null
    linkedTransactionId: string | null
    recurringId: string | null
}

// Legacy alias preserved for any straggler component reading `items` / `itemsCount` —
// these point at children. Remove after a sweep confirms no readers remain.
export type TransactionItem = Transaction

export interface TransactionFilters {
    type?: 'income' | 'expense' | 'transfer'
    types?: string[]
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
    include_excluded?: boolean
    include_split_children?: boolean
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

Changes vs Phase 2:
- `items: TransactionItem[]` → `children?: Transaction[]`
- `itemsCount?: number` → `childrenCount?: number`
- `TransactionItem` aliased to `Transaction` to keep the type name available for any consumers.

- [ ] **Step 2: Build, expect targeted errors**

Run: `npm run build`
Expected: errors only where code reads `.items` or `.itemsCount`. Most likely:
- `src/api/transactions.ts:74` — `items: []` no longer matches type
- `src/components/features/transactions/columns.tsx` — `row.original.items` and `row.original.itemsCount`
- `src/pages/transactions/[id]/edit.tsx` — `transaction.items?.map(...)`
- `src/pages/transactions/index.tsx` — `TransactionItems` subcomponent rendering `row.original.items`
- `src/components/features/transactions/TransactionForm.tsx` — items field array

DO NOT fix them yet. Subsequent tasks handle each.

- [ ] **Step 3: Commit**

```bash
git add src/types/transactions.ts
git commit -m "$(cat <<'EOF'
refactor: rename Transaction.items to children for split unification

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update `toTransaction` + `getAll` to attach children to parents

**Files:**
- Modify: `src/api/transactions.ts`

Children are rows in the same sheet with `parent_id` set. `applyFilters` already strips them from the default list unless `include_split_children` is true. The read path needs to:
1. Load ALL rows once (including children) before applying filters.
2. Map each parent to its `children`.
3. Then apply `applyFilters` which hides children by default.

- [ ] **Step 1: Update `toTransaction` to drop `items: []`**

Find `toTransaction` (around line 60). Replace:

```ts
    items: [],
```

with nothing — `children` is optional and we'll attach it in `getAll`.

Also rename any `itemsCount` reference; remove if present. The new field is `childrenCount` and will be set when children are attached.

- [ ] **Step 2: Update `getAll` to attach children**

Find `getAll` (around line 130). Replace its body's loading section. The function currently does:

```ts
  getAll: async (filters?: ...): Promise<TransactionsResponse> => {
    const [rows, lookups] = await Promise.all([
      adapter.getAll('transactions'),
      loadLookups(),
    ])
    let txns = rows.map(r => toTransaction(r, lookups.accountMap, lookups.categoryMap, lookups.tagMap))
    if (filters) txns = applyFilters(txns, filters)
    // ...
  },
```

Insert child-grouping BEFORE `applyFilters`:

```ts
  getAll: async (filters?: TransactionFilters & { with_summary?: boolean; per_page?: number; page?: number }): Promise<TransactionsResponse> => {
    const [rows, lookups] = await Promise.all([
      adapter.getAll('transactions'),
      loadLookups(),
    ])
    let txns = rows.map(r => toTransaction(r, lookups.accountMap, lookups.categoryMap, lookups.tagMap))

    // Group children under parents. Children remain in the flat list so
    // `include_split_children: true` callers can still see them; parents
    // additionally gain `.children` and `.childrenCount`.
    const childrenByParent = new Map<string, Transaction[]>()
    for (const t of txns) {
      if (t.parentId) {
        const arr = childrenByParent.get(t.parentId) ?? []
        arr.push(t)
        childrenByParent.set(t.parentId, arr)
      }
    }
    for (const t of txns) {
      if (!t.parentId) {
        const c = childrenByParent.get(t.id)
        if (c && c.length > 0) {
          t.children = c
          t.childrenCount = c.length
        }
      }
    }

    if (filters) txns = applyFilters(txns, filters)
    // ...rest unchanged
  },
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: errors only in UI code reading `items` (Task 5+). The api file itself should be clean.

- [ ] **Step 4: Commit**

```bash
git add src/api/transactions.ts
git commit -m "$(cat <<'EOF'
feat: group split children under parents in transactionsApi.getAll

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Upgrade `expandSplitChildrenForCategoryView` to actually expand (TDD)

**Files:**
- Modify: `src/lib/transaction-filters.ts`
- Modify: `src/lib/__tests__/transaction-filters.test.ts`

In Phase 2 this helper was a pass-through. Now that children are loaded, expand each parent (with children) into its child rows; parents without children pass through unchanged.

- [ ] **Step 1: Write failing tests**

Append to `src/lib/__tests__/transaction-filters.test.ts`:

```ts
describe('expandSplitChildrenForCategoryView (with children)', () => {
  it('replaces parents that have children with their child rows', () => {
    const child1 = txn({ id: 'c1', parentId: 'p', amount: 60 })
    const child2 = txn({ id: 'c2', parentId: 'p', amount: 40 })
    const parent = { ...txn({ id: 'p', amount: 100 }), children: [child1, child2] } as Transaction
    const result = expandSplitChildrenForCategoryView([parent])
    expect(result.map(t => t.id)).toEqual(['c1', 'c2'])
  })
  it('passes through parents that have no children', () => {
    const a = txn({ id: 'a' })
    const b = txn({ id: 'b' })
    expect(expandSplitChildrenForCategoryView([a, b]).map(t => t.id)).toEqual(['a', 'b'])
  })
  it('skips children that appear standalone (no .children on the row above them)', () => {
    // When a caller passes a flat list including both parent and children,
    // the parent still expands to its children; the children rows in the
    // input are NOT additionally emitted (avoids double-counting).
    const child1 = txn({ id: 'c1', parentId: 'p' })
    const child2 = txn({ id: 'c2', parentId: 'p' })
    const parent = { ...txn({ id: 'p' }), children: [child1, child2] } as Transaction
    const result = expandSplitChildrenForCategoryView([parent, child1, child2])
    expect(result.map(t => t.id)).toEqual(['c1', 'c2'])
  })
})
```

You will need to import `Transaction` from `@/types`. If not already imported in the test file, add:
```ts
import type { Transaction } from '@/types'
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- src/lib/__tests__/transaction-filters.test.ts`
Expected: FAIL — current pass-through implementation returns input unchanged.

- [ ] **Step 3: Implement**

Replace `expandSplitChildrenForCategoryView` in `src/lib/transaction-filters.ts`:

```ts
// Replace each parent (a row whose .children is non-empty) with its children.
// Rows whose own id appears as another row's parent_id are dropped to prevent
// double-counting. Rows with no .children pass through.
export function expandSplitChildrenForCategoryView(
  txns: Transaction[],
): Transaction[] {
  const parentIdsWithChildren = new Set<string>()
  for (const t of txns) {
    if (t.children && t.children.length > 0) parentIdsWithChildren.add(t.id)
  }
  const result: Transaction[] = []
  for (const t of txns) {
    // Skip child rows of a parent we will expand below.
    if (t.parentId && parentIdsWithChildren.has(t.parentId)) continue
    if (t.children && t.children.length > 0) {
      result.push(...t.children)
    } else {
      result.push(t)
    }
  }
  return result
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- src/lib/__tests__/transaction-filters.test.ts`
Expected: 10 passing (7 from before + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/transaction-filters.ts src/lib/__tests__/transaction-filters.test.ts
git commit -m "$(cat <<'EOF'
feat: implement expandSplitChildrenForCategoryView with real expansion

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extend `transactionSchema` with `children` array + XOR + sum refinement

**Files:**
- Modify: `src/schemas/transactions.ts`

- [ ] **Step 1: Add `splitChildSchema`**

Open `src/schemas/transactions.ts`. After the existing imports and before `transactionSchema`, add:

```ts
export const splitChildSchema = z.object({
    id: z.string().min(1).optional(),
    description: z.string().max(255).nullable().optional(),
    quantity: z.coerce.number().min(0.0001).nullable().optional(),
    price_per_unit: z.coerce.number().min(0).nullable().optional(),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    category_id: z.string().min(1).nullable().optional(),
    debt_id: z.string().min(1).nullable().optional(),
}).superRefine((data, ctx) => {
    const hasCategory = !!data.category_id
    const hasDebt = !!data.debt_id
    if (hasCategory === hasDebt) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each split child must have exactly one of category or debt',
            path: ['category_id'],
        })
    }
})

export type SplitChildFormData = z.infer<typeof splitChildSchema>
```

- [ ] **Step 2: Add `children` field + refinements to `transactionSchema`**

Find the existing `transactionSchema = z.object({ ... }).superRefine(...)`. Inside the `z.object({})` body (alongside the existing fields), add:

```ts
    children: z.array(splitChildSchema).optional(),
```

At the END of the existing `.superRefine((data, ctx) => { ... })` callback, append:

```ts
    // Phase 3: split children must sum to parent amount (within 0.01).
    if (data.children && data.children.length > 0) {
        const sum = data.children.reduce((s, c) => s + (c.amount || 0), 0)
        if (Math.abs(sum - data.amount) > 0.01) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Children total (${sum.toFixed(2)}) must equal amount (${data.amount.toFixed(2)})`,
                path: ['children'],
            })
        }
    }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean for the schema file. Other files may still have errors (items references) — that's fine, later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/schemas/transactions.ts
git commit -m "$(cat <<'EOF'
feat: add splitChildSchema with XOR refinement; children array on transactionSchema

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire children create/update/delete in `transactionsApi`

**Files:**
- Modify: `src/api/transactions.ts`

Children are written as separate rows with `parent_id = parentId`. The parent itself stores no children — they live as siblings in the sheet, attached at read time (Task 2).

- [ ] **Step 1: Update `create` to also persist children**

Open `src/api/transactions.ts`. Find the `create` method. After `await adapter.create('transactions', row)` and after `applyTransactionEffects(created, 1)`, add child creation:

```ts
    // Phase 3: persist children if provided.
    if (data.children && data.children.length > 0) {
      for (const c of data.children) {
        const childRow = {
          id: uuidv4(),
          type: data.type,
          account_id: String(data.account_id),
          to_account_id: '',
          category_id: c.category_id ? String(c.category_id) : '',
          amount: c.amount,
          to_amount: '',
          exchange_rate: '',
          description: c.description ?? '',
          date: data.date,
          tag_ids: '',
          is_excluded: 'false',
          is_one_time: 'false',
          parent_id: id,
          debt_id: c.debt_id ? String(c.debt_id) : '',
          linked_transaction_id: '',
          recurring_id: '',
          created_at: new Date().toISOString(),
        }
        await adapter.create('transactions', childRow)

        // Apply debt-balance side-effect on debt-linked children.
        if (c.debt_id) {
          await debtsApi.updateBalance(String(c.debt_id), c.amount)
        }
      }
    }
```

Add the import at the top of the file if missing:
```ts
import { debtsApi } from './debts'
```

- [ ] **Step 2: Update `delete` to cascade child removal**

Find the `delete` method. Replace its body with:

```ts
  delete: async (id: string | number): Promise<void> => {
    const existing = await transactionsApi.getById(id)

    // Cascade: delete all children first, reversing each child's effects.
    if (existing.children && existing.children.length > 0) {
      for (const child of existing.children) {
        if (child.debtId) {
          await debtsApi.updateBalance(child.debtId, -child.amount)
        }
        await adapter.delete('transactions', String(child.id))
      }
    }

    await adapter.delete('transactions', String(id))
    await applyTransactionEffects(existing, -1)
  },
```

- [ ] **Step 3: `update` keeps existing behavior**

`update` does NOT touch children — splits are managed via dedicated `useSplitTransaction` / `useUnsplitTransaction` mutations (Task 7). If a caller passes `children` to `update`, ignore it.

In the `update` method's adapter call, strip `children` from the patch payload by leaving it out (it's already absent from the existing destructure pattern — confirm).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean for transactions.ts. (UI errors persist; later tasks.)

- [ ] **Step 5: Commit**

```bash
git add src/api/transactions.ts
git commit -m "$(cat <<'EOF'
feat: persist + cascade-delete split children in transactionsApi

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add `splitTransaction` and `unsplitTransaction` API methods

**Files:**
- Modify: `src/api/transactions.ts`

Splitting an existing transaction = adding children to an existing parent. Unsplitting = removing all children, parent stays.

- [ ] **Step 1: Add `split` method**

In the `transactionsApi` object (near `delete`), add:

```ts
  split: async (parentId: string | number, children: SplitChildFormData[]): Promise<Transaction> => {
    const parent = await transactionsApi.getById(parentId)

    // Validate sum equals parent amount within 0.01.
    const sum = children.reduce((s, c) => s + c.amount, 0)
    if (Math.abs(sum - parent.amount) > 0.01) {
      throw new Error(`Children total (${sum.toFixed(2)}) must equal parent amount (${parent.amount.toFixed(2)})`)
    }

    // Delete any existing children first (idempotent re-split).
    if (parent.children && parent.children.length > 0) {
      for (const c of parent.children) {
        if (c.debtId) await debtsApi.updateBalance(c.debtId, -c.amount)
        await adapter.delete('transactions', String(c.id))
      }
    }

    // Write new children.
    for (const c of children) {
      const childRow = {
        id: uuidv4(),
        type: parent.type,
        account_id: parent.account.id,
        to_account_id: '',
        category_id: c.category_id ? String(c.category_id) : '',
        amount: c.amount,
        to_amount: '',
        exchange_rate: '',
        description: c.description ?? '',
        date: parent.date,
        tag_ids: '',
        is_excluded: 'false',
        is_one_time: 'false',
        parent_id: String(parentId),
        debt_id: c.debt_id ? String(c.debt_id) : '',
        linked_transaction_id: '',
        recurring_id: '',
        created_at: new Date().toISOString(),
      }
      await adapter.create('transactions', childRow)
      if (c.debt_id) {
        await debtsApi.updateBalance(String(c.debt_id), c.amount)
      }
    }

    return transactionsApi.getById(parentId)
  },
```

- [ ] **Step 2: Add `unsplit` method**

```ts
  unsplit: async (parentId: string | number): Promise<Transaction> => {
    const parent = await transactionsApi.getById(parentId)
    if (parent.children && parent.children.length > 0) {
      for (const c of parent.children) {
        if (c.debtId) await debtsApi.updateBalance(c.debtId, -c.amount)
        await adapter.delete('transactions', String(c.id))
      }
    }
    return transactionsApi.getById(parentId)
  },
```

- [ ] **Step 3: Import `SplitChildFormData`**

At the top of `src/api/transactions.ts`, with the other schema imports:
```ts
import type { TransactionFormValues as TransactionFormData, SplitChildFormData } from '@/schemas'
```

If `src/schemas/index.ts` doesn't re-export `SplitChildFormData`, add it:
```ts
// in src/schemas/index.ts
export { transactionSchema, splitChildSchema } from './transactions'
export type { TransactionFormValues, SplitChildFormData } from './transactions'
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean for api file.

- [ ] **Step 5: Commit**

```bash
git add src/api/transactions.ts src/schemas/index.ts
git commit -m "$(cat <<'EOF'
feat: add transactionsApi.split and unsplit methods

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add `useSplitTransaction` and `useUnsplitTransaction` mutation hooks

**Files:**
- Modify: `src/hooks/use-transactions.ts`

- [ ] **Step 1: Add the hooks**

Open `src/hooks/use-transactions.ts`. After `useToggleTransactionFlag`, append:

```ts
export function useSplitTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: {
            parentId: string | number
            children: SplitChildFormData[]
        }) => {
            return transactionsApi.split(params.parentId, params.children)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            queryClient.invalidateQueries({ queryKey: ['debts'] })
            toast.success('Transaction split saved')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to split transaction')
        },
    })
}

export function useUnsplitTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => transactionsApi.unsplit(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            queryClient.invalidateQueries({ queryKey: ['debts'] })
            toast.success('Transaction unsplit')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to unsplit')
        },
    })
}
```

Add `SplitChildFormData` to the imports at top:
```ts
import type { SplitChildFormData } from '@/schemas'
```

- [ ] **Step 2: Re-export if needed**

If `src/hooks/index.ts` uses named exports, add `useSplitTransaction`, `useUnsplitTransaction`. If it's `export *`, no change.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean for hooks. UI errors persist.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-transactions.ts src/hooks/index.ts
git commit -m "$(cat <<'EOF'
feat: add useSplitTransaction and useUnsplitTransaction hooks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create `SplitEditor` component

**Files:**
- Create: `src/components/features/transactions/SplitEditor.tsx`

A controlled table editor. Rows: description, qty, price, amount, type (Category / Debt), picker. Live sum row. Save / Cancel / Unsplit buttons. Parent's amount is locked context.

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Save, X, Split } from 'lucide-react'
import { useCategories, useDebts } from '@/hooks'
import { CategorySelect } from '@/components/shared/CategorySelect'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'
import type { SplitChildFormData } from '@/schemas'

interface SplitEditorProps {
  parent: Transaction
  onSave: (children: SplitChildFormData[]) => void
  onCancel: () => void
  onUnsplit?: () => void
  isSubmitting?: boolean
}

interface DraftChild {
  id?: string
  description: string
  quantity: string
  price_per_unit: string
  amount: string
  mode: 'category' | 'debt'
  category_id: string | null
  debt_id: string | null
}

function emptyRow(): DraftChild {
  return {
    description: '',
    quantity: '',
    price_per_unit: '',
    amount: '',
    mode: 'category',
    category_id: null,
    debt_id: null,
  }
}

function fromExisting(c: Transaction): DraftChild {
  return {
    id: c.id,
    description: c.description ?? '',
    quantity: '',
    price_per_unit: '',
    amount: String(c.amount),
    mode: c.debtId ? 'debt' : 'category',
    category_id: c.category?.id ?? null,
    debt_id: c.debtId,
  }
}

export function SplitEditor({ parent, onSave, onCancel, onUnsplit, isSubmitting }: SplitEditorProps) {
  const { data: debts } = useDebts()
  const [rows, setRows] = useState<DraftChild[]>(() =>
    parent.children && parent.children.length > 0
      ? parent.children.map(fromExisting)
      : [emptyRow(), emptyRow()]
  )

  const decimals = parent.account.currency?.decimals ?? 2
  const symbol = parent.account.currency?.symbol ?? ''

  // Live sum
  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const diff = parent.amount - sum
  const isBalanced = Math.abs(diff) < 0.01

  const updateRow = (idx: number, patch: Partial<DraftChild>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  // Auto-compute amount when qty + price both present
  useEffect(() => {
    setRows(prev =>
      prev.map(r => {
        const q = Number(r.quantity)
        const p = Number(r.price_per_unit)
        if (q > 0 && p >= 0) {
          return { ...r, amount: (q * p).toFixed(decimals) }
        }
        return r
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addRow = () => setRows(prev => [...prev, emptyRow()])
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))

  const canSave = isBalanced && rows.every(r =>
    Number(r.amount) > 0 &&
    ((r.mode === 'category' && r.category_id) || (r.mode === 'debt' && r.debt_id))
  )

  const handleSave = () => {
    if (!canSave) return
    const children: SplitChildFormData[] = rows.map(r => ({
      ...(r.id ? { id: r.id } : {}),
      description: r.description || undefined,
      quantity: r.quantity ? Number(r.quantity) : undefined,
      price_per_unit: r.price_per_unit ? Number(r.price_per_unit) : undefined,
      amount: Number(r.amount),
      category_id: r.mode === 'category' ? r.category_id : null,
      debt_id: r.mode === 'debt' ? r.debt_id : null,
    }))
    onSave(children)
  }

  const compatibleDebts = (debts ?? []).filter(d => {
    if (parent.account.currency?.id !== d.currencyId) return false
    if (parent.type === 'expense') return d.debtType === 'i_owe'
    if (parent.type === 'income') return d.debtType === 'owed_to_me'
    return false
  })

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium">Description</th>
            <th className="text-left p-2 font-medium w-16">Qty</th>
            <th className="text-left p-2 font-medium w-24">Price</th>
            <th className="text-left p-2 font-medium w-28">Amount</th>
            <th className="text-left p-2 font-medium w-40">Attribute to</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-1">
                <Input
                  value={r.description}
                  onChange={e => updateRow(i, { description: e.target.value })}
                  placeholder="(optional)"
                  className="h-8 border-0 shadow-none focus-visible:ring-1"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  step="0.0001"
                  min={0}
                  value={r.quantity}
                  onChange={e => {
                    const q = e.target.value
                    const p = Number(r.price_per_unit)
                    const next: Partial<DraftChild> = { quantity: q }
                    if (Number(q) > 0 && p >= 0) next.amount = (Number(q) * p).toFixed(decimals)
                    updateRow(i, next)
                  }}
                  className="h-8 border-0 shadow-none focus-visible:ring-1"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={r.price_per_unit}
                  onChange={e => {
                    const p = e.target.value
                    const q = Number(r.quantity)
                    const next: Partial<DraftChild> = { price_per_unit: p }
                    if (Number(p) >= 0 && q > 0) next.amount = (Number(p) * q).toFixed(decimals)
                    updateRow(i, next)
                  }}
                  className="h-8 border-0 shadow-none focus-visible:ring-1"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={r.amount}
                  onChange={e => updateRow(i, { amount: e.target.value })}
                  className="h-8 border-0 shadow-none focus-visible:ring-1 font-mono"
                />
              </td>
              <td className="p-1">
                <div className="flex gap-1">
                  <Select
                    value={r.mode}
                    onValueChange={(v) => updateRow(i, { mode: v as 'category' | 'debt', category_id: null, debt_id: null })}
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="debt" disabled={compatibleDebts.length === 0}>Debt</SelectItem>
                    </SelectContent>
                  </Select>
                  {r.mode === 'category' ? (
                    <div className="flex-1">
                      <CategorySelect
                        value={r.category_id}
                        onChange={(v) => updateRow(i, { category_id: v })}
                        type={parent.type === 'transfer' ? 'expense' : parent.type as 'income' | 'expense'}
                      />
                    </div>
                  ) : (
                    <Select
                      value={r.debt_id ?? ''}
                      onValueChange={(v) => updateRow(i, { debt_id: v })}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Pick debt" />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleDebts.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </td>
              <td className="p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/30">
          <tr>
            <td colSpan={3} className="p-2 text-right text-muted-foreground">
              Parent: {parent.amount.toFixed(decimals)} {symbol}
            </td>
            <td className={cn(
              'p-2 text-right font-mono font-semibold',
              !isBalanced && 'text-destructive'
            )}>
              {sum.toFixed(decimals)} {symbol}
              {!isBalanced && (
                <span className="block text-xs">
                  diff: {diff.toFixed(decimals)}
                </span>
              )}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
      <div className="flex items-center gap-2 p-2 border-t bg-muted/20">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4 mr-1" />
          Add row
        </Button>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-4 mr-1" />
          Cancel
        </Button>
        {onUnsplit && parent.children && parent.children.length > 0 && (
          <Button type="button" variant="destructive" size="sm" onClick={onUnsplit}>
            <Split className="size-4 mr-1" />
            Unsplit
          </Button>
        )}
        <Button type="button" size="sm" onClick={handleSave} disabled={!canSave || isSubmitting}>
          <Save className="size-4 mr-1" />
          Save split
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean for the new file. Other files (legacy items consumers) still error.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/transactions/SplitEditor.tsx
git commit -m "$(cat <<'EOF'
feat: add SplitEditor component with sum-validation and debt picker

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire SplitEditor into view page

**Files:**
- Modify: `src/pages/transactions/[id]/index.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useState } from 'react'
import { Split } from 'lucide-react'
import { SplitEditor } from '@/components/features/transactions/SplitEditor'
import { useSplitTransaction, useUnsplitTransaction } from '@/hooks'
```

(Adjust the existing imports — useState may already be imported, etc.)

- [ ] **Step 2: Add state + hook**

Inside the component, after other hooks:

```ts
  const [splitMode, setSplitMode] = useState(false)
  const splitTransaction = useSplitTransaction()
  const unsplitTransaction = useUnsplitTransaction()
```

- [ ] **Step 3: Render existing children (if any) as a read-only table BEFORE the action bar**

Find the section between Details grid and Action bar (or between Connections panel and Action bar). Insert:

```tsx
        {/* Split children table (read-only display) */}
        {t.children && t.children.length > 0 && !splitMode && (
          <Card>
            <CardContent className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">Split into {t.children.length} children</div>
                <Button size="sm" variant="outline" onClick={() => setSplitMode(true)}>
                  <Split className="size-4 mr-1" />
                  Edit split
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Description</th>
                    <th className="text-left py-1">Attribution</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {t.children.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="py-1.5">{c.description || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="py-1.5">
                        {c.debtId ? <span>$ Debt</span> : (c.category?.name ?? <span className="text-muted-foreground italic">no category</span>)}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        <AmountText value={c.amount} decimals={t.account.currency?.decimals ?? 2} currency={t.account.currency?.symbol} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Split editor (inline) */}
        {splitMode && (
          <SplitEditor
            parent={t}
            isSubmitting={splitTransaction.isPending}
            onCancel={() => setSplitMode(false)}
            onUnsplit={() => {
              unsplitTransaction.mutate(t.id, {
                onSuccess: () => setSplitMode(false),
              })
            }}
            onSave={(children) => {
              splitTransaction.mutate(
                { parentId: t.id, children },
                { onSuccess: () => setSplitMode(false) },
              )
            }}
          />
        )}
```

- [ ] **Step 4: Add "Split" button to action bar (only when no children yet)**

In the action bar, BEFORE the Delete button (and after the other quick-toggles), add:

```tsx
          {!t.children?.length && !splitMode && (
            <Button variant="outline" onClick={() => setSplitMode(true)}>
              <Split className="size-4 mr-1" />
              Split
            </Button>
          )}
```

- [ ] **Step 5: Build + tests**

Run: `npm run build`
Expected: clean for this file. Other consumers of `.items` still error.

- [ ] **Step 6: Commit**

```bash
git add src/pages/transactions/\[id\]/index.tsx
git commit -m "$(cat <<'EOF'
feat: wire SplitEditor and children display into transaction view page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update list view to handle children (drop legacy items table)

**Files:**
- Modify: `src/pages/transactions/index.tsx`

The `TransactionItems` subcomponent (around lines 75-117) currently reads `row.original.items`. Since `items` is gone, switch it to read `row.original.children` and the field name `pricePerUnit` → `pricePerUnit` is unchanged but `c.totalPrice` is now `c.amount`, `c.name` is now `c.description`.

- [ ] **Step 1: Rewrite `TransactionItems`**

Replace the existing `TransactionItems` function with:

```tsx
function TransactionItems({ row }: { row: Row<Transaction> }) {
  const children = row.original.children
  const decimals = row.original.account.currency?.decimals ?? 2
  const symbol = row.original.account.currency?.symbol
  if (!children || children.length === 0) return null

  return (
    <div className="px-4 py-3 ml-10">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="text-left font-medium pb-2">Description</th>
            <th className="text-left font-medium pb-2">Attribution</th>
            <th className="text-right font-medium pb-2 w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {children.map((c) => (
            <tr key={c.id} className="border-t border-border/50">
              <td className="py-1.5">{c.description || <span className="text-muted-foreground italic">—</span>}</td>
              <td className="py-1.5">
                {c.debtId ? '$ Debt payment' : (c.category?.name ?? '—')}
              </td>
              <td className="py-1.5 text-right font-mono font-medium">
                <AmountText value={c.amount} decimals={decimals} currency={symbol} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Update `getRowCanExpand` and other places reading `itemsCount`**

Open `src/components/features/transactions/columns.tsx`. Find references to `itemsCount` and `items`. Update each:

```tsx
// Was: const itemsCount = row.original.itemsCount ?? row.original.items?.length ?? 0
// Now:
const childrenCount = row.original.childrenCount ?? row.original.children?.length ?? 0
if (childrenCount <= 1) return null
```

Apply the same rename in the badge condition that shows "split N ways".

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/transactions/index.tsx src/components/features/transactions/columns.tsx
git commit -m "$(cat <<'EOF'
refactor: render children inline in transaction list (drop legacy items)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Drop the legacy items table from `TransactionForm`

**Files:**
- Modify: `src/components/features/transactions/TransactionForm.tsx`

The items table on the create/edit form was never functional (Phase 1 noted: items dropped on read). Items are now children, edited via SplitEditor on view page. Remove the items section from the form entirely.

- [ ] **Step 1: Strip the items table block**

Open `src/components/features/transactions/TransactionForm.tsx`. Find:
- The `useFieldArray({ name: 'items' })` block.
- The `items` watch.
- The `itemsTotal` reduce.
- The `useEffect` that syncs amount with items total.
- The `handleKeyDown`, `addItem`, `itemRefs` helpers.
- The entire JSX block rendering the "Items" table (between the Tags FormField and the submit Button).

Remove all of them. Keep:
- All other form state.
- The newly-added Phase 2 flag toggles.

The form should now have: type tabs → account/category → balance preview → amount/date → description → flags → tags → submit. No items table.

Also remove `items: defaultValues?.items ?? []` from `formDefaults` and remove the legacy `items` field from `transactionSchema` if present (the schema no longer has it after Phase 1 cleanup, but double-check).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Update `src/pages/transactions/[id]/edit.tsx` too**

Open `src/pages/transactions/[id]/edit.tsx`. Find:

```ts
items: transaction.items?.map(item => ({
    name: item.name,
    quantity: item.quantity,
    price_per_unit: item.pricePerUnit,
})) ?? [],
```

Remove that block from `defaultValues`. Items are no longer a form field.

- [ ] **Step 4: Build + tests**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: ≥ 22 passing (19 from before + 3 new from Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/transactions/TransactionForm.tsx src/pages/transactions/\[id\]/edit.tsx
git commit -m "$(cat <<'EOF'
refactor: drop legacy items table from TransactionForm

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final verification

- [ ] **Step 1: Type-check + build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: ≥ 22 passing.

- [ ] **Step 3: Manual smoke**

```
1. Open /transactions, create a $100 expense in Groceries.
2. Open the transaction view page. Click "Split".
3. SplitEditor opens with 2 empty rows.
4. Enter row 1: description="Apples", amount=60, Attribute to Category: "Groceries".
5. Enter row 2: description="Pet food", amount=40, Attribute to Category: "Pets".
6. Sum row shows 100/100 (green). Click "Save split".
7. View page now shows the children table with both rows.
8. List page: parent shows "split 2 ways" badge. Expand row → children inline.
9. Open /reports, ExpensesByCategory: spend is attributed to Groceries (60) + Pets (40), not to Groceries (100).
10. Open the view page again. Click "Edit split". SplitEditor opens pre-filled.
11. Change row 1 amount to 50. Sum shows 90/100 (red). Save disabled.
12. Change row 2 amount to 50. Sum shows 100/100. Save.
13. Click "Edit split" again → "Unsplit". Confirm. Children gone. Parent intact.

Debt-link path:
14. Create another $30 expense. View page → Split → 2 rows.
15. Row 1: $20 Category Groceries. Row 2: $10 Attribute to Debt → pick a debt.
16. Save. Debt's remaining-debt decreases by 10. View debt detail to confirm.
```

If any step fails, do NOT mark Phase 3 complete.

- [ ] **Step 4: Tag**

```bash
git tag phase-3-splits
```

---

## Known follow-ups for Phase 4+

- "Linked counterpart" picker + mark-debt-payment for parent-level transactions.
- Recurring engine + recurring_id linkage.
- View page action bar still needs Link / Mark-debt-payment / Create-recurring buttons (Phases 4 + 5).
