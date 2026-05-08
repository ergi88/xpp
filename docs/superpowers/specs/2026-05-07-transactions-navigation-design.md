# Transactions Page — Date Navigation, Account Filter & Responsive Fix

**Date:** 2026-05-07

## Overview

Add a unified date navigation block above the transactions table with period summary, multi-select account filter pills, `created_at` sort option, and fix the mobile x-scroll caused by non-wrapping filter rows.

---

## 1. State & URL Params

### Removed
- `startDate` — replaced by nav state
- `endDate` — replaced by nav state

### Added
- `navMode: 'month' | 'day'` — default `'month'`
- `navDate: string` — ISO date string, default = first day of current month (e.g. `'2026-05-01'`)
- `accountIds: string[]` — default `[]` (empty = all accounts)

### Extended
- `sortBy` gains `'created_at'` as a valid value

### Derived API params
From `navMode` + `navDate`, compute `start_date` / `end_date` sent to the API:
- **month mode:** `start_date` = first day of month, `end_date` = last day of month
- **day mode:** `start_date` = `end_date` = `navDate`

---

## 2. Navigation Block

Full-width, three-column layout: `[←] [center] [→]`

### Arrow behavior
- **Month mode:** `←` / `→` navigate by 1 month
- **Day mode:** `←` / `→` navigate by 1 day

### Center interaction (drill-down)
- Clicking center in **month mode** → switches to day mode; `navDate` = today if current month, else 1st of that month
- Clicking center in **day mode** → pops back to month mode (preserves same month)

### Center content — 3 rows

| Row | Content |
|-----|---------|
| 1 | Label + period: `"Total Income: May 2026"` / `"Total Income: 6 May 2026"` |
| 2 | Formatted amount (currency symbol + value) |
| 3 | `"All Accounts"` if `accountIds` empty, else account names joined (max 2 names, then `"3 Accounts"`) |

**Row 1 label** based on active type filter:
- `null` → "Net Balance"
- `income` → "Total Income"
- `expense` → "Total Expense"
- `transfer` → "Total Transfers"

**Row 2 value** from `useTransactionSummary` called with all active filters (type, accountIds, derived date range):
- `null` → `summary.income − summary.expense` (signed, can be negative)
- `income` → `summary.income`
- `expense` → `summary.expense`
- `transfer` → `summary.transfer`

**Period format:**
- Month mode: `"MMM YYYY"` (e.g. "May 2026")
- Day mode: `"D MMM YYYY"` (e.g. "6 May 2026")

---

## 3. Filter Rows (Responsive)

Replace the current single non-wrapping row with two separate `flex flex-wrap gap-2` rows:

**Row A — Type filter:**
```
[All] [Income] [Expense] [Transfer]
```

**Row B — Account filter:**
```
[All Accounts] [Bank] [Cash] [Card ···]
```

- Accounts loaded from `useAccounts({ active: true })`
- Multi-select: toggle individual account pills; selecting "All Accounts" clears `accountIds`
- Both rows wrap on mobile — no x-scroll

The Sort select moves to its own line on mobile (stays right-aligned on desktop via `justify-between` on a wrapper).

---

## 4. Collapsible Filters Panel

Remove the manual **Date Range** inputs (nav block replaces them).

`activeFiltersCount` no longer counts date fields. Remaining counted filters: `categoryIds`, `tagIds`.

---

## 5. API Changes

### `src/types/transactions.ts`
- Add `account_ids?: string[]` to `TransactionFilters`
- Add `transfer: number` to `TransactionSummary`

### `src/api/transactions.ts`

**`applyFilters`:**
```ts
// account_ids multi-select
if (filters.account_ids?.length)
  result = result.filter(t => filters.account_ids!.includes(t.account?.id))

// created_at sort
const va = sort_by === 'created_at' ? a.createdAt
         : sort_by === 'amount'     ? a.amount
         :                            a.date
```

**Summary computation — add transfer:**
```ts
transfer: aggregateTxns.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
```

### `src/pages/transactions/index.tsx`

Add to `SORT_OPTIONS`:
```ts
{ value: 'created_at:desc', label: 'Date Added (Newest)' },
{ value: 'created_at:asc',  label: 'Date Added (Oldest)' },
```

Extend `transactionSearchParams`:
```ts
navMode:    parseAsStringLiteral(['month', 'day']).withDefault('month'),
navDate:    parseAsString.withDefault(firstDayOfCurrentMonth()),
accountIds: parseAsArrayOf(parseAsString).withDefault([]),
```

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/types/transactions.ts` | Add `account_ids` to filters, `transfer` to summary |
| `src/api/transactions.ts` | `account_ids` filter, `created_at` sort, `transfer` in summary |
| `src/pages/transactions/index.tsx` | Nav block, account pills row, responsive fix, remove date inputs, new sort options |

---

## 7. Out of Scope

- Persisting selected date across page reloads beyond URL params (already handled by nuqs)
- Animations on drill-down
- Account type icons on pills (can be added later)
