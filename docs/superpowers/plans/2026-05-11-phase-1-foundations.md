# Transactions Overhaul — Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all additive schema columns, pure filter helpers, a unified transaction-effects function (no behavior change), a transaction view page, list-row badges, and list filter toggles. Unlocks Phases 2–5.

**Architecture:** Additive only — every change is backward-compatible. New `transactions` columns get auto-added by `gas/Code.gs:ensureColumns` when first written. The Transaction read path coerces missing columns to safe defaults (`false`, `null`, `''`). The mutation path is refactored behind a single `applyTransactionEffects(txn, sign)` function with no observable change. A new view page at `/transactions/:id` becomes the default landing for row clicks. No data migration step.

**Tech Stack:** React 19, TypeScript, vite, react-router-dom v6, @tanstack/react-query, @tanstack/react-table, react-hook-form + zod, tailwind, vitest (added in Task 1).

**Source spec:** [`docs/superpowers/specs/2026-05-11-transactions-debts-recurring-overhaul-design.md`](../specs/2026-05-11-transactions-debts-recurring-overhaul-design.md)

**Testing note:** Codebase currently has zero tests. Task 1 installs vitest. TDD applies to pure-logic units (coerce, filters, effects). UI tasks have manual smoke-test instructions instead of unit tests because no testing-library is installed and adding it is out of scope here.

**Commit discipline:** Each task ends with a commit. Conventional commits — `feat:`, `refactor:`, `test:`, `chore:`. Always include the trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## File structure (Phase 1)

| Action | Path | Responsibility |
|---|---|---|
| Create | `vitest.config.ts` | Vitest config (jsdom env, alias `@/`) |
| Modify | `package.json` | Add `vitest`, `@vitest/coverage-v8`, `jsdom`, `test` scripts |
| Modify | `tsconfig.json` | Include vitest types |
| Create | `src/lib/coerce.ts` | `toBool`, `toIdOrNull` helpers |
| Create | `src/lib/__tests__/coerce.test.ts` | Unit tests for coerce |
| Create | `src/lib/transaction-filters.ts` | Pure filter helpers |
| Create | `src/lib/__tests__/transaction-filters.test.ts` | Unit tests for filters |
| Modify | `src/types/transactions.ts` | Add new fields to `Transaction`; drop unused union members |
| Modify | `src/schemas/transactions.ts` | Add new fields + refinements; drop `transactionItemSchema` references that no longer compile |
| Modify | `src/api/transactions.ts` | `toTransaction` reads new columns. `create/update/delete` persist new columns. Mutation routed through `applyTransactionEffects`. |
| Create | `src/api/transaction-effects.ts` | `applyTransactionEffects(txn, sign)` single mutation choke point |
| Create | `src/api/__tests__/transaction-effects.test.ts` | Unit tests for effects |
| Modify | `src/components/features/transactions/columns.tsx` | New badge cell + visual styling for excluded/one-time/recurring/linked/debt |
| Modify | `src/pages/transactions/index.tsx` | Add filter toggles ("Show excluded", "Show split children"); row click navigates to view page |
| Create | `src/pages/transactions/[id]/index.tsx` | Transaction view page shell |
| Modify | `src/app/router.tsx` | Register `transactions/:id` route |
| Create | `src/scripts/backfill-transaction-flags.ts` | One-off TS script to stamp `is_excluded=false`, `is_one_time=false` on every existing transaction row |

---

## Task 1: Install vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install dev deps**

```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/jest-dom
```

Expected: deps added to `package.json`, lockfile updated. No errors.

- [ ] **Step 2: Add test scripts to `package.json`**

Edit the `scripts` section of `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts` at repo root**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Update `tsconfig.json` to include vitest types**

Open `tsconfig.json`. Find the `compilerOptions.types` array (or add one). Ensure it includes `"vitest/globals"`. If `types` is not set, add:

```json
"compilerOptions": {
  "types": ["vitest/globals"]
}
```

If multiple tsconfigs exist (e.g. `tsconfig.app.json`), put it in the one that compiles `src/`.

- [ ] **Step 5: Verify vitest runs (empty test pass)**

Create temporary file `src/__smoke__.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`
Expected: 1 file, 1 passing test. No errors. If failure mentions missing react plugin or jsdom, re-check Step 3.

Delete `src/__smoke__.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json
git commit -m "$(cat <<'EOF'
chore: add vitest with jsdom for unit tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TDD `src/lib/coerce.ts`

**Files:**
- Create: `src/lib/coerce.ts`
- Create: `src/lib/__tests__/coerce.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/coerce.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toBool, toIdOrNull } from '@/lib/coerce'

describe('toBool', () => {
  it('returns true for true, "true", "TRUE", 1, "1"', () => {
    expect(toBool(true)).toBe(true)
    expect(toBool('true')).toBe(true)
    expect(toBool('TRUE')).toBe(true)
    expect(toBool(1)).toBe(true)
    expect(toBool('1')).toBe(true)
  })
  it('returns false for false, "false", "FALSE", 0, "0", "", undefined, null', () => {
    expect(toBool(false)).toBe(false)
    expect(toBool('false')).toBe(false)
    expect(toBool('FALSE')).toBe(false)
    expect(toBool(0)).toBe(false)
    expect(toBool('0')).toBe(false)
    expect(toBool('')).toBe(false)
    expect(toBool(undefined)).toBe(false)
    expect(toBool(null)).toBe(false)
  })
})

describe('toIdOrNull', () => {
  it('returns null for empty/missing values', () => {
    expect(toIdOrNull('')).toBeNull()
    expect(toIdOrNull(undefined)).toBeNull()
    expect(toIdOrNull(null)).toBeNull()
  })
  it('returns string id for non-empty values', () => {
    expect(toIdOrNull('abc')).toBe('abc')
    expect(toIdOrNull(123)).toBe('123')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- src/lib/__tests__/coerce.test.ts`
Expected: FAIL — "Cannot find module '@/lib/coerce'".

- [ ] **Step 3: Implement `src/lib/coerce.ts`**

```ts
export function toBool(v: unknown): boolean {
  if (v === true) return true
  if (v === 1) return true
  if (typeof v === 'string') {
    const norm = v.trim().toLowerCase()
    return norm === 'true' || norm === '1'
  }
  return false
}

export function toIdOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v)
  return s === '' ? null : s
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- src/lib/__tests__/coerce.test.ts`
Expected: 2 files, 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/coerce.ts src/lib/__tests__/coerce.test.ts
git commit -m "$(cat <<'EOF'
feat: add coerce utility for sheet-cell normalization

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TDD `src/lib/transaction-filters.ts`

**Files:**
- Create: `src/lib/transaction-filters.ts`
- Create: `src/lib/__tests__/transaction-filters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/transaction-filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import {
  excludeExcluded,
  excludeOneTime,
  excludeSplitChildren,
  collapseLinkedPairs,
} from '@/lib/transaction-filters'

function txn(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    id: overrides.id,
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 10,
    date: overrides.date ?? '2026-05-01',
    account: overrides.account ?? ({ id: 'a1' } as Transaction['account']),
    items: [],
    tags: [],
    isExcluded: overrides.isExcluded ?? false,
    isOneTime: overrides.isOneTime ?? false,
    parentId: overrides.parentId ?? null,
    debtId: overrides.debtId ?? null,
    linkedTransactionId: overrides.linkedTransactionId ?? null,
    recurringId: overrides.recurringId ?? null,
    ...overrides,
  } as Transaction
}

describe('excludeExcluded', () => {
  it('removes rows with isExcluded=true', () => {
    const list = [txn({ id: '1' }), txn({ id: '2', isExcluded: true }), txn({ id: '3' })]
    expect(excludeExcluded(list).map(t => t.id)).toEqual(['1', '3'])
  })
})

describe('excludeOneTime', () => {
  it('removes rows with isOneTime=true', () => {
    const list = [txn({ id: '1' }), txn({ id: '2', isOneTime: true })]
    expect(excludeOneTime(list).map(t => t.id)).toEqual(['1'])
  })
})

describe('excludeSplitChildren', () => {
  it('removes rows with parentId set', () => {
    const list = [txn({ id: '1' }), txn({ id: '2', parentId: 'p1' })]
    expect(excludeSplitChildren(list).map(t => t.id)).toEqual(['1'])
  })
})

describe('collapseLinkedPairs', () => {
  it('keeps the first of a mutually-linked pair, drops the second', () => {
    const a = txn({ id: 'a', linkedTransactionId: 'b' })
    const b = txn({ id: 'b', linkedTransactionId: 'a' })
    const c = txn({ id: 'c' })
    expect(collapseLinkedPairs([a, b, c]).map(t => t.id)).toEqual(['a', 'c'])
  })
  it('keeps unlinked rows untouched', () => {
    const list = [txn({ id: '1' }), txn({ id: '2' })]
    expect(collapseLinkedPairs(list).map(t => t.id)).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: Run the tests, expect failure**

Run: `npm test -- src/lib/__tests__/transaction-filters.test.ts`
Expected: FAIL — "Cannot find module '@/lib/transaction-filters'". Also: Transaction type missing `isExcluded`, `isOneTime`, `parentId`, `debtId`, `linkedTransactionId`, `recurringId`. These will be added in Task 4 — for now, satisfy them.

- [ ] **Step 3: Implement `src/lib/transaction-filters.ts`**

```ts
import type { Transaction } from '@/types'

export function excludeExcluded(txns: Transaction[]): Transaction[] {
  return txns.filter(t => !t.isExcluded)
}

export function excludeOneTime(txns: Transaction[]): Transaction[] {
  return txns.filter(t => !t.isOneTime)
}

export function excludeSplitChildren(txns: Transaction[]): Transaction[] {
  return txns.filter(t => !t.parentId)
}

export function collapseLinkedPairs(txns: Transaction[]): Transaction[] {
  const dropped = new Set<string>()
  const result: Transaction[] = []
  for (const t of txns) {
    if (dropped.has(t.id)) continue
    result.push(t)
    if (t.linkedTransactionId) dropped.add(t.linkedTransactionId)
  }
  return result
}
```

Note: this file will fail to compile until Task 4 adds the new fields to `Transaction`. That's fine — we run tests after Task 4.

- [ ] **Step 4: Commit (test will run green only after Task 4)**

```bash
git add src/lib/transaction-filters.ts src/lib/__tests__/transaction-filters.test.ts
git commit -m "$(cat <<'EOF'
feat: add transaction-filters helpers (pending type update)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update `Transaction` type and drop unused union members

**Files:**
- Modify: `src/types/transactions.ts`

- [ ] **Step 1: Replace the file**

Open `src/types/transactions.ts`. Replace the existing contents with:

```ts
import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface TransactionItem {
    id?: string
    name: string
    quantity: number
    pricePerUnit: number
    totalPrice: number
}

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
    items: TransactionItem[]
    itemsCount?: number
    tags: Tag[]
    // Phase 1 fields:
    isExcluded: boolean
    isOneTime: boolean
    parentId: string | null
    debtId: string | null
    linkedTransactionId: string | null
    recurringId: string | null
}

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

Changes vs current:
- `TransactionType` no longer includes `'debt_payment' | 'debt_collection'`. Debt payment is now a flag (`debtId` set), not a type.
- Six new required fields with defaults set in `toTransaction` (Task 6).
- Two new filter flags `include_excluded` and `include_split_children` (used in list page).

- [ ] **Step 2: Verify the codebase still compiles**

Run: `npm run build`
Expected: Errors in:
- `src/components/features/transactions/columns.tsx` — `TYPE_CONFIG.debt_payment` and `.debt_collection` cells no longer match the union.
- `src/api/transactions.ts:67` — `toTransaction` missing new fields.

Both fixed in subsequent tasks. Note them; do not fix here.

- [ ] **Step 3: Commit**

```bash
git add src/types/transactions.ts
git commit -m "$(cat <<'EOF'
feat: add Phase 1 fields to Transaction type, drop debt_payment/collection union

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Remove dead `debt_payment` / `debt_collection` cases from columns

**Files:**
- Modify: `src/components/features/transactions/columns.tsx`

- [ ] **Step 1: Edit `TYPE_CONFIG`**

Open `src/components/features/transactions/columns.tsx`. Replace the `TYPE_CONFIG` declaration (lines 27–33) with:

```ts
const TYPE_CONFIG = {
    income: { icon: ArrowDownLeft, color: 'text-green-600', bg: 'bg-green-100', label: 'Income' },
    expense: { icon: ArrowUpRight, color: 'text-red-600', bg: 'bg-red-100', label: 'Expense' },
    transfer: { icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Transfer' },
}
```

Also remove the now-unused imports `Banknote` and `HandCoins` from the `lucide-react` import on line 22.

- [ ] **Step 2: Build, expect only the `api/transactions.ts` error left**

Run: `npm run build`
Expected: errors only in `src/api/transactions.ts` (toTransaction missing new fields).

- [ ] **Step 3: Commit**

```bash
git add src/components/features/transactions/columns.tsx
git commit -m "$(cat <<'EOF'
refactor: drop unused debt_payment/debt_collection cells in columns

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update `toTransaction` to read new columns

**Files:**
- Modify: `src/api/transactions.ts`

- [ ] **Step 1: Update the `toTransaction` function**

Open `src/api/transactions.ts`. Replace lines 49–71 (the entire `toTransaction` function) with:

```ts
import { toBool, toIdOrNull } from '@/lib/coerce'

// (keep existing imports above; just add this one at the top)

function toTransaction(
  r: Record<string, unknown>,
  accountMap: Map<string, unknown>,
  categoryMap: Map<string, unknown>,
  tagMap: Map<string, unknown>,
): Transaction {
  const tagIds = r.tag_ids ? String(r.tag_ids).split(',').filter(Boolean) : []
  return {
    id: r.id as string,
    type: r.type as Transaction['type'],
    amount: Number(r.amount),
    toAmount: r.to_amount ? Number(r.to_amount) : undefined,
    exchangeRate: r.exchange_rate ? Number(r.exchange_rate) : undefined,
    description: r.description as string | undefined,
    date: toLocalDateString(r.date),
    account: accountMap.get(r.account_id as string) as Transaction['account'],
    toAccount: r.to_account_id ? accountMap.get(r.to_account_id as string) as Transaction['toAccount'] : undefined,
    category: r.category_id ? categoryMap.get(r.category_id as string) as Transaction['category'] : undefined,
    items: [],
    tags: tagIds.map(tid => tagMap.get(tid)).filter(Boolean) as Transaction['tags'],
    isExcluded: toBool(r.is_excluded),
    isOneTime: toBool(r.is_one_time),
    parentId: toIdOrNull(r.parent_id),
    debtId: toIdOrNull(r.debt_id),
    linkedTransactionId: toIdOrNull(r.linked_transaction_id),
    recurringId: toIdOrNull(r.recurring_id),
    createdAt: r.created_at as string,
  }
}
```

- [ ] **Step 2: Run filters test (added in Task 3) — should now pass**

Run: `npm test -- src/lib/__tests__/transaction-filters.test.ts`
Expected: 4 files, 6 passing tests.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: clean build. No errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/transactions.ts
git commit -m "$(cat <<'EOF'
feat: read Phase 1 transaction columns via coerce helpers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Extend `transactionSchema` (zod)

**Files:**
- Modify: `src/schemas/transactions.ts`

- [ ] **Step 1: Add new fields and refinement**

Open `src/schemas/transactions.ts`. Locate the `transactionSchema` object body (lines 9–39). Add the following fields **before** the `.superRefine(...)`:

```ts
    is_excluded: z.boolean().default(false),
    is_one_time: z.boolean().default(false),
    parent_id: z.string().min(1).nullable().optional(),
    debt_id: z.string().min(1).nullable().optional(),
    linked_transaction_id: z.string().min(1).nullable().optional(),
    recurring_id: z.string().min(1).nullable().optional(),
```

Add the following refinement at the **end** of the existing `.superRefine((data, ctx) => { ... })` callback:

```ts
    // Phase 1 invariants:
    if (data.is_excluded && data.is_one_time) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Transaction cannot be both excluded and one-time',
            path: ['is_one_time'],
        })
    }
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/schemas/transactions.ts
git commit -m "$(cat <<'EOF'
feat: extend transactionSchema with Phase 1 flag fields + mutex refinement

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: TDD `applyTransactionEffects` (extract existing balance math, no behavior change)

**Files:**
- Create: `src/api/transaction-effects.ts`
- Create: `src/api/__tests__/transaction-effects.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/api/__tests__/transaction-effects.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateAccount = vi.fn()
const updateDebt = vi.fn()

vi.mock('@/api/accounts', () => ({
  accountsApi: { updateBalance: (...args: unknown[]) => updateAccount(...args) },
  getBaseCurrencyMeta: vi.fn(),
  isAccountIncludedInBaseAggregates: vi.fn(() => true),
}))
vi.mock('@/api/debts', () => ({
  debtsApi: { updateBalance: (...args: unknown[]) => updateDebt(...args) },
}))

import { applyTransactionEffects } from '@/api/transaction-effects'
import type { Transaction } from '@/types'

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    type: 'expense',
    amount: 100,
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
    ...overrides,
  } as Transaction
}

beforeEach(() => {
  updateAccount.mockReset()
  updateDebt.mockReset()
})

describe('applyTransactionEffects', () => {
  it('expense +1: account -amount', async () => {
    await applyTransactionEffects(txn({ type: 'expense', amount: 100 }), 1)
    expect(updateAccount).toHaveBeenCalledWith('a1', -100)
  })
  it('expense -1: account +amount (reversal)', async () => {
    await applyTransactionEffects(txn({ type: 'expense', amount: 100 }), -1)
    expect(updateAccount).toHaveBeenCalledWith('a1', 100)
  })
  it('income +1: account +amount', async () => {
    await applyTransactionEffects(txn({ type: 'income', amount: 50 }), 1)
    expect(updateAccount).toHaveBeenCalledWith('a1', 50)
  })
  it('transfer +1: from -amount, to +to_amount', async () => {
    await applyTransactionEffects(
      txn({
        type: 'transfer',
        amount: 100,
        toAmount: 95,
        toAccount: { id: 'a2' } as Transaction['toAccount'],
      }),
      1,
    )
    expect(updateAccount).toHaveBeenCalledWith('a1', -100)
    expect(updateAccount).toHaveBeenCalledWith('a2', 95)
  })
  it('transfer +1 with no to_amount: uses amount on both sides', async () => {
    await applyTransactionEffects(
      txn({
        type: 'transfer',
        amount: 100,
        toAmount: undefined,
        toAccount: { id: 'a2' } as Transaction['toAccount'],
      }),
      1,
    )
    expect(updateAccount).toHaveBeenCalledWith('a1', -100)
    expect(updateAccount).toHaveBeenCalledWith('a2', 100)
  })
  it('split child (parentId set): no account mutation', async () => {
    await applyTransactionEffects(txn({ parentId: 'p1' }), 1)
    expect(updateAccount).not.toHaveBeenCalled()
  })
  it('debtId set: reduces debt by amount (parent-level)', async () => {
    await applyTransactionEffects(txn({ type: 'expense', amount: 40, debtId: 'd1' }), 1)
    expect(updateAccount).toHaveBeenCalledWith('a1', -40)
    expect(updateDebt).toHaveBeenCalledWith('d1', -40)
  })
  it('debtId set with sign=-1: reverses debt reduction', async () => {
    await applyTransactionEffects(txn({ type: 'expense', amount: 40, debtId: 'd1' }), -1)
    expect(updateDebt).toHaveBeenCalledWith('d1', 40)
  })
})
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/api/__tests__/transaction-effects.test.ts`
Expected: FAIL — "Cannot find module '@/api/transaction-effects'".

- [ ] **Step 3: Check whether `debtsApi.updateBalance` exists**

Run: `grep -n "updateBalance" src/api/debts.ts`
Expected: a method or function name. If missing, note for Step 4.

- [ ] **Step 4: Implement `src/api/transaction-effects.ts`**

```ts
import { accountsApi } from '@/api/accounts'
import { debtsApi } from '@/api/debts'
import type { Transaction } from '@/types'

type Sign = 1 | -1

export async function applyTransactionEffects(
  txn: Transaction,
  sign: Sign,
): Promise<void> {
  // Split children do not touch account balance — the parent already does.
  const touchesAccount = !txn.parentId

  if (touchesAccount) {
    if (txn.type === 'income') {
      await accountsApi.updateBalance(txn.account.id, txn.amount * sign)
    } else if (txn.type === 'expense') {
      await accountsApi.updateBalance(txn.account.id, -txn.amount * sign)
    } else if (txn.type === 'transfer') {
      const toAmount = txn.toAmount ?? txn.amount
      await accountsApi.updateBalance(txn.account.id, -txn.amount * sign)
      if (txn.toAccount) {
        await accountsApi.updateBalance(txn.toAccount.id, toAmount * sign)
      }
    }
  }

  if (txn.debtId) {
    // Reducing remaining debt by `amount * sign` matches existing
    // `accountsApi.updateBalance` convention (signed delta).
    await debtsApi.updateBalance(txn.debtId, -txn.amount * sign)
  }
}
```

If Step 3 showed `debtsApi.updateBalance` does NOT exist: add it now in `src/api/debts.ts` as a thin wrapper around the existing remaining-debt mutation in that file. Mirror the pattern of `accountsApi.updateBalance`. If unsure how `debts` stores its balance, search: `grep -n "currentBalance\|remainingDebt\|targetAmount" src/api/debts.ts`. Add the wrapper to take `(id: string, delta: number)` and apply it to the appropriate balance field.

- [ ] **Step 5: Run tests, expect pass**

Run: `npm test -- src/api/__tests__/transaction-effects.test.ts`
Expected: 1 file, 8 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/api/transaction-effects.ts src/api/__tests__/transaction-effects.test.ts src/api/debts.ts
git commit -m "$(cat <<'EOF'
feat: extract applyTransactionEffects single mutation choke point

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Refactor `transactionsApi.create / update / delete` to use `applyTransactionEffects`

**Files:**
- Modify: `src/api/transactions.ts`

- [ ] **Step 1: Add import**

At the top of `src/api/transactions.ts`, add:

```ts
import { applyTransactionEffects } from './transaction-effects'
```

- [ ] **Step 2: Replace the `create` method**

Replace lines 168–198 (the current `create` method) with:

```ts
  create: async (data: TransactionFormData): Promise<Transaction> => {
    const id = uuidv4()
    const row = {
      id,
      type: data.type,
      account_id: String(data.account_id),
      to_account_id: data.to_account_id ? String(data.to_account_id) : '',
      category_id: data.category_id ? String(data.category_id) : '',
      amount: data.amount,
      to_amount: data.to_amount ?? '',
      exchange_rate: data.exchange_rate ?? '',
      description: data.description ?? '',
      date: data.date,
      tag_ids: (data.tag_ids ?? []).join(','),
      is_excluded: data.is_excluded ? 'true' : 'false',
      is_one_time: data.is_one_time ? 'true' : 'false',
      parent_id: data.parent_id ?? '',
      debt_id: data.debt_id ?? '',
      linked_transaction_id: data.linked_transaction_id ?? '',
      recurring_id: data.recurring_id ?? '',
      created_at: new Date().toISOString(),
    }
    await adapter.create('transactions', row)

    const created = await transactionsApi.getById(id)
    await applyTransactionEffects(created, 1)
    return created
  },
```

- [ ] **Step 3: Replace the `update` method**

Replace lines 200–229 (the current `update` method) with:

```ts
  update: async (id: string | number, data: Partial<TransactionFormData>): Promise<Transaction> => {
    const existing = await transactionsApi.getById(id)
    await adapter.update('transactions', String(id), {
      ...data,
      tag_ids: data.tag_ids ? data.tag_ids.join(',') : undefined,
      is_excluded: data.is_excluded === undefined ? undefined : (data.is_excluded ? 'true' : 'false'),
      is_one_time: data.is_one_time === undefined ? undefined : (data.is_one_time ? 'true' : 'false'),
      parent_id: data.parent_id ?? undefined,
      debt_id: data.debt_id ?? undefined,
      linked_transaction_id: data.linked_transaction_id ?? undefined,
      recurring_id: data.recurring_id ?? undefined,
    } as Record<string, unknown>)

    await applyTransactionEffects(existing, -1)
    const updated = await transactionsApi.getById(id)
    await applyTransactionEffects(updated, 1)
    return updated
  },
```

- [ ] **Step 4: Replace the `delete` method**

Replace lines 231–244 (the current `delete` method) with:

```ts
  delete: async (id: string | number): Promise<void> => {
    const existing = await transactionsApi.getById(id)
    await adapter.delete('transactions', String(id))
    await applyTransactionEffects(existing, -1)
  },
```

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 6: Manual smoke test (cannot unit-test against real GAS)**

```
1. npm run dev → open the app.
2. Create an expense transaction. Verify account balance decreases by the amount.
3. Edit the transaction, change amount. Verify balance reflects new amount (not the sum of old+new).
4. Delete the transaction. Verify balance returns to the original.
5. Repeat for income and transfer.
```

If any step fails, do NOT mark this task complete. Diagnose; the most likely bug is sign inversion in `applyTransactionEffects`. Compare against the pre-refactor logic at the previous commit.

- [ ] **Step 7: Commit**

```bash
git add src/api/transactions.ts
git commit -m "$(cat <<'EOF'
refactor: route transaction CRUD through applyTransactionEffects

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add visual badges + icons to transaction list rows

**Files:**
- Modify: `src/components/features/transactions/columns.tsx`

- [ ] **Step 1: Add badge cell inside the description column**

Open `src/components/features/transactions/columns.tsx`. Find the `description` accessor column (around line 89–93). Replace its cell with a version that adds badges:

```tsx
{
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => {
        const t = row.original
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span className={cn('truncate', t.isExcluded && 'opacity-60')}>
                    {t.description || <span className="text-muted-foreground italic">No description</span>}
                </span>
                {t.isOneTime && <span title="One-time">★</span>}
                {t.isExcluded && <span title="Excluded">⊘</span>}
                {t.recurringId && <span title="From recurring">↻</span>}
                {t.linkedTransactionId && <span title="Linked counterpart">⇄</span>}
                {t.debtId && <span title="Debt payment">$</span>}
            </div>
        )
    },
},
```

Adjust this snippet to fit the actual existing column shape (keep header text, keep `accessorKey`). If `description` is currently a multi-line cell with extra info, preserve that and just add the badge row beneath the description text.

- [ ] **Step 2: Apply row-level fade for excluded rows**

Open `src/pages/transactions/index.tsx`. Find where `DataTable` is rendered. Pass a `rowClassName` (if supported) that fades excluded rows:

```tsx
<DataTable
  // ...existing props,
  rowClassName={(row: Transaction) => row.isExcluded ? 'opacity-60' : ''}
/>
```

If `DataTable` does not accept `rowClassName`, open `src/components/shared/DataTable.tsx`, add the prop, and apply it to each `<TableRow>`. Keep it backward-compatible (default to empty string).

- [ ] **Step 3: Manual smoke**

```
npm run dev
1. Force one transaction to is_excluded=true by editing the spreadsheet directly OR
   by setting it via the form (toggle added in Phase 2 — until then, manual edit).
2. Reload the transactions list. Verify the row is faded and shows ⊘.
3. Force one with is_one_time=true. Verify ★ appears.
4. Force one with recurring_id, linked_transaction_id, debt_id. Verify each icon.
```

- [ ] **Step 4: Commit**

```bash
git add src/components/features/transactions/columns.tsx src/pages/transactions/index.tsx src/components/shared/DataTable.tsx
git commit -m "$(cat <<'EOF'
feat: add badge/icon indicators to transaction list rows

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add list filter toggles "Show excluded" + "Show split children"

**Files:**
- Modify: `src/pages/transactions/index.tsx`
- Modify: `src/api/transactions.ts`

- [ ] **Step 1: Wire the filter through the API**

Open `src/api/transactions.ts`. In `applyFilters` (around line 73–99), at the **start** of the function add:

```ts
  // Hide split children unless explicitly requested
  if (!filters.include_split_children) {
    result = result.filter(t => !t.parentId)
  }
  // Hide excluded unless explicitly requested
  if (!filters.include_excluded) {
    result = result.filter(t => !t.isExcluded)
  }
```

(Note: `applyFilters` is called inside `getAll`. The current logic always strips nothing of these. Toggles default to OFF = strip-by-default, which is the desired behavior.)

- [ ] **Step 2: Add the toggles to the filter bar**

Open `src/pages/transactions/index.tsx`. Find the filter UI (Collapsible filter section). Inside the filter content, add two checkboxes:

```tsx
import { Checkbox } from '@/components/ui/checkbox'

// Inside the filter section, near the existing toggles:
<div className="flex items-center gap-2">
  <Checkbox
    id="show-excluded"
    checked={filters.include_excluded ?? false}
    onCheckedChange={(v) => setFilters({ ...filters, include_excluded: !!v })}
  />
  <label htmlFor="show-excluded" className="text-sm">Show excluded</label>
</div>
<div className="flex items-center gap-2">
  <Checkbox
    id="show-split-children"
    checked={filters.include_split_children ?? false}
    onCheckedChange={(v) => setFilters({ ...filters, include_split_children: !!v })}
  />
  <label htmlFor="show-split-children" className="text-sm">Show split children</label>
</div>
```

Adjust prop names (`filters`, `setFilters`) to match the actual `useQueryStates` API used in this file (around line 5–9). Persist both toggles in URL state if other filters are already URL-persisted.

- [ ] **Step 3: Pass them to `useTransactions`**

In the same file, ensure the `useTransactions(...)` call (or whichever hook fetches the list) receives the two new filter fields. They flow through `TransactionFilters` (already extended in Task 4) to `applyFilters` in `src/api/transactions.ts`.

- [ ] **Step 4: Manual smoke**

```
1. Default view: excluded rows hidden, split children (if any) hidden.
2. Toggle "Show excluded" ON: excluded rows appear (faded).
3. Toggle "Show split children" ON: child rows of any split parent appear inline.
4. Reload page: URL params persist toggle state if other filters are URL-persisted.
```

- [ ] **Step 5: Commit**

```bash
git add src/api/transactions.ts src/pages/transactions/index.tsx
git commit -m "$(cat <<'EOF'
feat: add list filter toggles for excluded and split-children visibility

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create the transaction view page shell

**Files:**
- Create: `src/pages/transactions/[id]/index.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useParams, Link } from 'react-router-dom'
import { Page } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AmountText } from '@/components/shared/AmountText'
import {
  useTransaction,
  useDeleteTransaction,
  useDuplicateTransaction,
} from '@/hooks'
import {
  Pencil,
  Copy,
  Trash2,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_CONFIG = {
  income: { icon: ArrowDownLeft, color: 'text-green-600', label: 'Income' },
  expense: { icon: ArrowUpRight, color: 'text-red-600', label: 'Expense' },
  transfer: { icon: ArrowLeftRight, color: 'text-blue-600', label: 'Transfer' },
}

export default function TransactionViewPage() {
  const { id } = useParams<{ id: string }>()
  const { data: t, isLoading } = useTransaction(id!)
  const deleteTransaction = useDeleteTransaction('/transactions')
  const duplicateTransaction = useDuplicateTransaction()

  if (isLoading) return <Page><div className="p-8">Loading...</div></Page>
  if (!t) return <Page><div className="p-8">Transaction not found.</div></Page>

  const cfg = TYPE_CONFIG[t.type]
  const Icon = cfg.icon
  const decimals = t.account.currency?.decimals ?? 2
  const symbol = t.account.currency?.symbol

  return (
    <Page>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/transactions" className="hover:underline flex items-center gap-1">
            <ArrowLeft className="size-3" />
            Transactions
          </Link>
          <span>/</span>
          <span>{new Date(t.date).toLocaleDateString()}</span>
        </div>

        {/* Hero */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Icon className={cn('size-6', cfg.color)} />
              <div className="text-3xl font-bold font-mono">
                <AmountText value={t.amount} decimals={decimals} currency={symbol} />
              </div>
              <Badge variant="secondary" className={cn('ml-2', cfg.color)}>{cfg.label}</Badge>
            </div>
            {t.description && <p className="text-muted-foreground">{t.description}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {t.tags.map(tag => <Badge key={tag.id} variant="outline">#{tag.name}</Badge>)}
              {t.isOneTime && <Badge variant="secondary">★ One-time</Badge>}
              {t.isExcluded && <Badge variant="secondary">⊘ Excluded</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Details grid */}
        <Card>
          <CardContent className="p-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Account</div>
              <Link to={`/accounts/${t.account.id}`} className="hover:underline font-medium">
                {t.account.name}
              </Link>
            </div>
            {t.toAccount ? (
              <div>
                <div className="text-muted-foreground">To Account</div>
                <Link to={`/accounts/${t.toAccount.id}`} className="hover:underline font-medium">
                  {t.toAccount.name}
                </Link>
              </div>
            ) : t.category ? (
              <div>
                <div className="text-muted-foreground">Category</div>
                <span className="font-medium">{t.category.name}</span>
              </div>
            ) : null}
            <div>
              <div className="text-muted-foreground">Date</div>
              <div className="font-mono">{new Date(t.date).toLocaleDateString()}</div>
            </div>
            {t.createdAt && (
              <div>
                <div className="text-muted-foreground">Created</div>
                <div className="font-mono text-xs">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connections panel (placeholders — wired in Phases 3–5) */}
        {(t.recurringId || t.linkedTransactionId || t.debtId) && (
          <Card>
            <CardContent className="p-6 space-y-2 text-sm">
              <div className="font-medium">Connections</div>
              {t.recurringId && (
                <Link to={`/recurring/${t.recurringId}/edit`} className="block hover:underline">
                  ↻ From recurring template →
                </Link>
              )}
              {t.linkedTransactionId && (
                <Link to={`/transactions/${t.linkedTransactionId}`} className="block hover:underline">
                  ⇄ Linked counterpart →
                </Link>
              )}
              {t.debtId && (
                <Link to={`/debts/${t.debtId}/edit`} className="block hover:underline">
                  $ Debt payment for →
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button asChild variant="default">
            <Link to={`/transactions/${t.id}/edit`}>
              <Pencil className="size-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" onClick={() => duplicateTransaction.mutate(t.id)}>
            <Copy className="size-4 mr-1" />
            Duplicate
          </Button>
          <Button variant="destructive" onClick={() => deleteTransaction.mutate(t.id)}>
            <Trash2 className="size-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </Page>
  )
}
```

- [ ] **Step 2: Verify imports exist**

Confirm each hook (`useTransaction`, `useDeleteTransaction`, `useDuplicateTransaction`) is exported from `@/hooks/index.ts`. If `useDuplicateTransaction` does not exist, grep: `grep -n "duplicate" src/hooks/use-transactions.ts`. If absent, add a thin wrapper in `src/hooks/use-transactions.ts` mirroring `useDeleteTransaction`, calling `transactionsApi.duplicate(id)` which already exists.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/transactions/\[id\]/index.tsx src/hooks/use-transactions.ts
git commit -m "$(cat <<'EOF'
feat: add transaction view page at /transactions/:id

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Register the view route + wire list-row click

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/pages/transactions/index.tsx`

- [ ] **Step 1: Add the lazy import + route**

Open `src/app/router.tsx`. Add near the other transaction imports:

```ts
const TransactionViewPage = lazy(() => import('@/pages/transactions/[id]/index'))
```

In the route children array, insert (between `transactions/create` and `transactions/:id/edit`):

```ts
{ path: 'transactions/:id', element: withSuspense(TransactionViewPage) },
```

- [ ] **Step 2: Make table rows navigate to the view page**

Open `src/pages/transactions/index.tsx`. Find the `DataTable` rendering. Add an `onRowClick` (or whatever the prop is named in `src/components/shared/DataTable.tsx`) that navigates to `/transactions/${row.id}`. Use `useNavigate` from `react-router-dom`. Example:

```tsx
import { useNavigate } from 'react-router-dom'

// inside the component:
const navigate = useNavigate()

// on the DataTable:
<DataTable
  // ...existing props,
  onRowClick={(row: Transaction) => navigate(`/transactions/${row.id}`)}
/>
```

If `DataTable` does not have `onRowClick`, add it the same way as `rowClassName` in Task 10 Step 2.

Beware: existing row actions (edit/delete dropdown) must NOT also trigger row navigation. In `DataTable`, ensure the click handler is on the row but events from buttons inside cells get `e.stopPropagation()` in their `onClick`. Inspect the dropdown trigger in the columns file and add `onClick={e => e.stopPropagation()}` to the trigger element if not already present.

- [ ] **Step 3: Manual smoke**

```
1. npm run dev
2. Visit /transactions
3. Click a transaction row → lands on /transactions/<id> showing hero + details
4. Click Edit on the view page → lands on /transactions/<id>/edit
5. From the list, open the row dropdown menu → it should NOT navigate; should open the menu
```

- [ ] **Step 4: Commit**

```bash
git add src/app/router.tsx src/pages/transactions/index.tsx src/components/shared/DataTable.tsx
git commit -m "$(cat <<'EOF'
feat: register transaction view route and wire list-row navigation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Backfill script for existing transactions

**Files:**
- Create: `src/scripts/backfill-transaction-flags.ts`

- [ ] **Step 1: Write the script**

```ts
// Run with: npx tsx src/scripts/backfill-transaction-flags.ts
// Purpose: stamp is_excluded='false', is_one_time='false' on every existing
// transaction row so downstream `toBool` calls behave consistently across
// browsers/clients.

import { adapter } from '@/api/client'

async function main() {
  const rows = await adapter.getAll('transactions')
  let updated = 0
  for (const r of rows) {
    const needsExcluded = r.is_excluded === undefined || r.is_excluded === ''
    const needsOneTime = r.is_one_time === undefined || r.is_one_time === ''
    if (!needsExcluded && !needsOneTime) continue
    const patch: Record<string, unknown> = {}
    if (needsExcluded) patch.is_excluded = 'false'
    if (needsOneTime) patch.is_one_time = 'false'
    await adapter.update('transactions', String(r.id), patch)
    updated++
    console.log(`Backfilled ${r.id}`)
  }
  console.log(`Done. ${updated}/${rows.length} rows updated.`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Install tsx if missing**

Run: `npm ls tsx`
If not installed: `npm install -D tsx`

- [ ] **Step 3: Dry-run the script against the live GAS endpoint**

```
npx tsx src/scripts/backfill-transaction-flags.ts
```

Expected: log line per row, then final "Done. N/M rows updated." line. Re-run a second time; should report `0/M rows updated.` (idempotent).

NOTE: this hits the live `VITE_GAS_URL`. Verify `.env` is pointing at the correct sheet before running. If a staging sheet exists, prefer that. If the live sheet is the only target, run during low-traffic time. There is no rollback — but a re-run with cleared flags requires manually editing the sheet.

- [ ] **Step 4: Commit (script only — no env changes)**

```bash
git add src/scripts/backfill-transaction-flags.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: backfill is_excluded/is_one_time defaults on existing transactions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Final verification

- [ ] **Step 1: Type-check + build**

Run: `npm run build`
Expected: clean exit, no TypeScript errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: at least 3 test files (`coerce`, `transaction-filters`, `transaction-effects`), all passing.

- [ ] **Step 3: Manual smoke checklist (end-to-end)**

```
1. Start dev server: npm run dev
2. Visit /transactions:
   - Default view: no excluded rows visible, no split children visible
   - Filter toggles "Show excluded" and "Show split children" present
3. Click a transaction row → /transactions/<id> view page renders
4. Verify view page Hero, Details, Action bar
5. Click Edit on view page → /transactions/<id>/edit loads form
6. Create a new transaction (any type) → balance updates correctly
7. Edit it → change amount, balance recalculates correctly (no double-application)
8. Delete it → balance returns to before
9. Reload /transactions → list is consistent
```

If any step fails, leave Phase 1 in_progress and diagnose. Do not move to Phase 2.

- [ ] **Step 4: Tag the release internally (optional)**

```bash
git tag phase-1-foundations
```

---

## Done?

If every task above is checked and Step 3 of Task 15 passes end-to-end, Phase 1 is complete. Next: I will (or the user will) invoke `writing-plans` again to author Phase 2 (Exclude + One-time semantics across reports/budgets/dashboard).
