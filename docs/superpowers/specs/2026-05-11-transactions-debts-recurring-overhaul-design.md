# Transactions / Debts / Recurring — Overhaul Design

**Date:** 2026-05-11
**Status:** Approved by user, ready for implementation plan
**Scope:** Add transaction view/edit pages, exclude/one-time flags, split transactions, transfer/debt-payment linking, recurring ↔ transaction linkage, and cross-section navigation. Refactor balance side-effects to a single function. Backfill missing recurring engine and `Transaction.items` persistence.

---

## 1. Goals and non-goals

### Goals

1. Let users mark a transaction as **excluded** (disabled from every aggregate) or **one-time** (counted historically, hidden from averages/budgets/projections).
2. Let users **split** a transaction into multiple category buckets and/or **link split children to debts**.
3. Let users **link two transactions as a transfer counterpart** (reconciliation) and/or **mark a transaction as a debt payment** (parent-level).
4. Add a **transaction view page** at `/transactions/:id` and surface a complete connections panel.
5. Let users **create a recurring template from any transaction** and **navigate from any generated transaction back to its recurring source**.
6. Place cross-section links everywhere: account → transaction view → category, debt, recurring, counterpart.
7. Apply exclude/one-time semantics consistently across reports, budgets, dashboard, and summary surfaces.

### Non-goals (deferred)

- FX-aware debt linking when account currency ≠ debt currency. Blocked by validation in v1.
- Full cron-style recurring engine. v1 = run-due on app load + manual "Run now" button.
- Soft-delete / undo history. Hard delete with cascade-confirm for split parents.
- Multi-currency split children with per-child exchange rates.
- Bulk operations on transactions (bulk exclude, bulk mark one-time). Deferred.

### Out of scope

- Account / category / tag CRUD redesigns.
- Reports/dashboard layout redesigns. We only change which data feeds them, not how they render.

---

## 2. Context: how the backend works today

- **Persistence** = Google Sheets via a Google Apps Script web app (`gas/Code.gs`).
- The `createRow` and `updateRow` helpers call `ensureColumns` which **auto-adds any new column** sent in the payload to the sheet header row.
- Existing rows that lack a new column simply have empty cells. Clients must coerce empty → default (e.g. `''` → `false`).
- There is no fixed schema enforcement and no migration tooling. **Additive schema changes are free**: send the new field once, the column appears, and old rows keep working.
- This is the design constraint that makes the rest of this spec safe: **no destructive migration step**. No data loss risk.

---

## 3. Schema changes (Phase 1 — additive only)

### 3.1 `transactions` sheet — new columns

| Column | Type | Empty/default | Meaning |
|---|---|---|---|
| `is_excluded` | boolean (`'true'`/`'false'`/`''`) | `false` | Skip from every aggregate. |
| `is_one_time` | boolean | `false` | Counted historically but excluded from averages, budgets, projections. |
| `parent_id` | string \| `''` | `''` | If set, this row is a split child of `parent_id`. |
| `debt_id` | string \| `''` | `''` | If set, this transaction (or split child) reduces this debt's balance. |
| `linked_transaction_id` | string \| `''` | `''` | Mutual link to a counterpart transaction (reconciliation pair). |
| `recurring_id` | string \| `''` | `''` | Set by the recurring engine on rows it generates. |

**Mutual-exclusion rules** (enforced in zod schema, not on the sheet):

- `is_excluded` and `is_one_time` are mutually exclusive.
- A row with `parent_id` set is a **split child**. Split children cannot themselves be parents (no nested splits).
- A split child must have **exactly one** of `category_id` or `debt_id` set (XOR).
- A parent transaction (one whose id appears as `parent_id` of any child) cannot have `linked_transaction_id` set. Counterpart linking applies to standalone transactions only.

### 3.2 `recurring` sheet — new column

| Column | Type | Empty/default | Meaning |
|---|---|---|---|
| `created_from_transaction_id` | string \| `''` | `''` | Traceability for templates spawned from "Create recurring from this." |

### 3.3 Backfill

Run a one-off TS script (or hand-edit in Sheets) after phase-1 deploy to set every existing row's `is_excluded` and `is_one_time` to `'false'`. This is defensive — string coercion of `''` should already default to false, but explicit values keep CSV exports and admin debugging clean. All other new columns can stay empty.

### 3.4 Coercion utility

Add `src/lib/coerce.ts`:

```ts
export const toBool = (v: unknown): boolean =>
  v === true || v === 'true' || v === 1 || v === '1'
export const toIdOrNull = (v: unknown): string | null =>
  v && v !== '' ? String(v) : null
```

Use in `toTransaction` so every consumer sees normalized booleans / nullable strings.

---

## 4. Domain rules

### 4.1 Exclude / one-time matrix

| Calculation surface | Excluded | One-time |
|---|---|---|
| Account `currentBalance` (real money) | counted | counted |
| Transactions list view | visible, faded + `⊘` badge | visible, `★` suffix |
| Transactions page summary tiles | **skipped** | included (UI toggle to hide) |
| Budget progress vs limit | **skipped** | **skipped** |
| Reports — category totals | **skipped** | included |
| Reports — trends / monthly averages | **skipped** | **skipped** |
| Dashboard — current-month spend tile | **skipped** | included |
| Dashboard — projections / cashflow forecast | **skipped** | **skipped** |
| Recurring detection / suggestions | **skipped** | **skipped** |
| CSV export | included with flag column | included with flag column |

Core distinction: **excluded** is invisible to every aggregate; **one-time** is visible in raw historical totals but hidden from anything that projects forward or averages.

### 4.2 Split transactions

- **Parent** = single account balance hit (unchanged from current behavior). Carries the `amount`, `date`, `account_id`, `description`, and may still carry its own `category_id` if not yet split.
- **Children** = annotation rows that re-attribute the parent amount across categories or debts.
- **Constraints**:
  - Sum of children's amounts must equal the parent's `amount` within 0.01.
  - Each child has exactly one of `category_id` or `debt_id` (XOR).
  - Child rows live in the same `transactions` sheet as parents. For sheet-row sanity each child row populates `account_id`, `date`, and `type` with the parent's values (duplicated), but the **parent is the source of truth**: edits to those fields on the parent propagate to children on save. Per-child fields are `amount`, `category_id`, `debt_id`, and optionally `description` / `quantity` / `price_per_unit`.
  - Children may have an optional `description` (used for line-item naming, replaces today's `items.name`).
  - Children may have optional `quantity` and `price_per_unit`. If both present, `amount = quantity * price_per_unit` (this is the legacy "items" use case, now unified into the split-child model — see §8).
- **Side-effects on children**:
  - Children with `category_id` are pure annotation. No balance impact.
  - Children with `debt_id` reduce the debt's balance by the child's amount on save, reverse on edit/delete.
- **Default queries hide children**: list view, summary, and most aggregates filter out rows with `parent_id !== ''`. Reports that need category attribution **expand** the parent into children when present, replacing the parent's row.

### 4.3 Counterpart linking (transfer-like)

- **Purpose**: pair two already-existing transactions (one expense + one income on different accounts) so reports don't double-count.
- **Stored** as `linked_transaction_id` on both rows, pointing at each other (mutual).
- **Match criteria** when picking a candidate to link:
  - Opposite types (one income, one expense)
  - Amount equal within 0.01 OR `to_amount` equal within 0.01 (FX)
  - Date within ±7 days of one another (configurable later, hard-coded for v1)
  - Different `account_id`
- **Side-effect of linking**: none on balances (both rows already mutated their account balances when created). Reports collapse the pair into a single transfer-like row.
- **Unlink**: clear `linked_transaction_id` on both sides.

### 4.4 Debt payment (parent-level)

- **Stored** as `debt_id` on the transaction. Mirrors the column used for split children.
- **Side-effect**: on save, debt balance reduced by transaction amount. On edit, reverse old + apply new. On delete, reverse.
- **Reports**: debt-payment transactions are excluded from category spend (they are a debt flow, not consumption). They remain in account balance.
- **Validation**: account currency must equal debt currency in v1. Otherwise block at form level.

### 4.5 Recurring linkage

- **Generated transactions** carry `recurring_id` pointing at the recurring template that spawned them. Set only by the recurring engine, never by user input.
- **"Create recurring from this"** creates a new recurring row with `created_from_transaction_id` set to the source transaction's id. The source transaction is unchanged.
- **No back-reference** is stored on the recurring template for the "spawned recurring" link — that direction is recovered by filtering recurring rows by `created_from_transaction_id`. (Cheap query, no duplicate state.)

---

## 5. Architecture

### 5.1 Unified side-effect function

Today's `transactionsApi.create / update / delete` each re-implement the same `accountsApi.updateBalance` math three times ([src/api/transactions.ts:186-243](../../src/api/transactions.ts#L186)). With debt-payments, split children, and linked-pair guards adding more cases, this duplication becomes a bug magnet.

Refactor to:

```ts
// src/api/transaction-effects.ts
type Sign = 1 | -1
async function applyTransactionEffects(txn: Transaction, sign: Sign) {
  // 1. Account balance — only if parent_id is empty.
  //    Income: +amount * sign. Expense: -amount * sign.
  //    Transfer: -amount * sign on from-account, +to_amount * sign on to-account.
  // 2. Debt balance — if debt_id is set (parent-level OR split child):
  //    Reduce debt remaining by amount * sign.
  // 3. Counterpart linking is balance-neutral: each linked transaction already
  //    moved its own account balance when it was created. No extra mutation
  //    on link or unlink.
}
```

`create`  → `applyTransactionEffects(new, +1)`
`update`  → `applyTransactionEffects(old, -1)` then `applyTransactionEffects(new, +1)`
`delete`  → `applyTransactionEffects(old, -1)` (plus cascade for split children)

This is the single mutation choke point. Every code path that changes a transaction goes through it.

### 5.2 Filter helpers

`src/lib/transaction-filters.ts`:

```ts
export const excludeExcluded = (txns) => txns.filter(t => !t.isExcluded)
export const excludeOneTime  = (txns) => txns.filter(t => !t.isOneTime)
export const excludeSplitChildren = (txns) => txns.filter(t => !t.parentId)
export const collapseLinkedPairs = (txns) => {
  // Keep first of each linked pair; drop the second.
  const seen = new Set<string>()
  return txns.filter(t => {
    if (!t.linkedTransactionId) return true
    if (seen.has(t.id)) return false
    seen.add(t.linkedTransactionId)
    return true
  })
}
export const expandSplitChildrenForCategoryView = (txns) => { /* flatten */ }
```

Each aggregate caller composes the helpers that match the matrix in §4.1.

### 5.3 Recurring engine (Phase 5)

- **Trigger 1** — app-load scan: on auth-bootstrap, fetch recurring where `is_active && next_run_date <= today`. For each, call a `runDue(recurring)` function that creates a transaction with `recurring_id` set, advances `next_run_date` according to frequency/interval, and saves.
- **Trigger 2** — manual button "Run now" on each recurring detail page that calls the same `runDue` once.
- Idempotency: `next_run_date` advance is the lock. After advance, the same template won't re-trigger until the new date arrives.
- Generated transactions inherit type, amount, account, category/to-account, description, tags from the recurring template. No items / splits.

### 5.4 Transaction view page

**Route:** `/transactions/[id]/index.tsx` (new file; sibling of existing `edit.tsx`).

**Layout (top → bottom):**

1. **Hero**: amount + currency, type icon, description, date, badges (`#tag`, `⊘ Excluded`, `★ One-time`, `↻ From recurring`, `⇄ Linked`, `$ Debt payment`).
2. **Details grid**: account link, category link (or to-account if transfer), created/modified timestamps.
3. **Connections panel** — only renders if any connection exists:
   - "From recurring: …" (if `recurring_id`)
   - "Linked counterpart: <date · account>" (if `linked_transaction_id`)
   - "Debt payment for: <debt name>" (if parent-level `debt_id`)
   - "Spawned recurring: <name>" (if any recurring has `created_from_transaction_id === this.id`)
4. **Split / items table** — only renders if children exist. Inline edit/unsplit buttons.
5. **Action bar**: Edit · Duplicate · Split · Link counterpart · Mark debt payment · Create recurring · Exclude toggle · One-time toggle · Delete.

### 5.5 List view changes

- Row click → navigate to `/transactions/[id]` (no more modal for view; modal stays for quick-add via FAB).
- Excluded rows = 60% opacity + `⊘` icon.
- One-time rows = `★` suffix on amount.
- Split parent = chevron disclosure that expands children inline (or simply renders a "split N ways" badge if collapsed).
- `recurring_id` set = small `↻` icon.
- `linked_transaction_id` set = small `⇄` icon.
- `debt_id` set = small `$` icon.
- New filter toggles in the filter bar: "Show excluded" (off by default), "Show split children" (off by default).

### 5.6 Cross-section navigation

- Account detail → transactions list → row → view page.
- Debt detail → "Linked transactions" tab (transactions where `debt_id === this.id`) → view page.
- Recurring detail → "Generated transactions" tab (transactions where `recurring_id === this.id`) → view page.
- Category page → transactions in category → view page.
- Transaction view → every connection chip links back to its entity.

---

## 6. UI/UX details

### 6.1 Exclude / one-time toggles

- Live on the edit page (TransactionForm extension) AND as quick-toggle buttons on the view page.
- Visual feedback on toggle: list row fades in real time; summary tiles update.
- Tooltip explains the matrix in a sentence: "Excluded transactions are hidden from every report and budget" / "One-time transactions count in history but are skipped from averages and projections."

### 6.2 Split editor

- Opens inline on the view page (no modal).
- Table with rows: `[description] [qty] [price] [amount] [category | debt] [×]`.
- Live "Total: X / Y" footer; submit blocked until equal.
- Each row's last column is a segmented control: `Category` vs `Debt`, switching the picker.
- "Unsplit" button = confirm dialog "Children will be deleted, parent retained" → cascade delete children, leave parent intact.

### 6.3 Counterpart link picker

- "Link counterpart" button → modal with auto-filtered candidate list:
  - Opposite type, amount match (±0.01 or FX `to_amount`), date ±7 days, different account, not already linked.
- One-click select → both sides updated, modal closes, view page refreshes with the new connection chip.

### 6.4 Mark as debt payment

- "Mark debt payment" button on view page → modal with debt picker (filtered to debts where currency = account currency).
- Confirm → set `debt_id`, apply debt balance side-effect, dismiss.
- Direction rules:
  - **Expense** transaction marked as debt payment → debt must be `i_owe`. Reduces what I owe.
  - **Income** transaction marked as debt payment → debt must be `owed_to_me`. Reduces what someone owes me.
  - The debt picker filters candidate debts by these rules so the user can't pick an incompatible debt.

### 6.5 Create recurring from transaction

- Button on view page → navigate to `/recurring/new?from_transaction=<id>`.
- New recurring page reads the query param, fetches the source transaction, prefills the form (type, account, category, amount, description, tags), defaults frequency to monthly, start date to today.
- On submit, saves with `created_from_transaction_id` set.

---

## 7. Reports / budgets / dashboard application (Phase 2)

Every aggregate composes filter helpers in the same order: `collapseLinkedPairs` → `excludeSplitChildren` (or `expandSplitChildrenForCategoryView` for category surfaces) → flag filters per matrix.

**Specific surfaces:**

| Surface | Filter chain |
|---|---|
| Transactions page summary tiles | `collapseLinkedPairs` → `excludeSplitChildren` → `excludeExcluded` |
| Budget `progress.spent` | `collapseLinkedPairs` → `expandSplitChildrenForCategoryView` → `excludeExcluded` → `excludeOneTime` |
| Reports — category totals | `collapseLinkedPairs` → `expandSplitChildrenForCategoryView` → `excludeExcluded` |
| Reports — trends / averages | `collapseLinkedPairs` → `excludeSplitChildren` → `excludeExcluded` → `excludeOneTime` |
| Dashboard — current-month spend tile | `collapseLinkedPairs` → `excludeSplitChildren` → `excludeExcluded` |
| Dashboard — projection / cashflow | same chain as trends |
| CSV export | NO filters; include the flag columns so users can filter in Excel |

**Note on budget `spent`**: today's code defines `BudgetProgress.spent` but no computation site is present. Phase 2 must add it. Place computation in `budgetsApi.getAll` (return `progress` for each budget) using the filter chain above. Match budget period (`monthly`/`yearly`) by clamping transaction `date` range.

---

## 8. Items model unification (Phase 3, bundled with split work)

The existing `Transaction.items` field is captured in the form but **dropped on read** ([src/api/transactions.ts:67](../../src/api/transactions.ts#L67)). The transaction items table in the form is effectively decorative today.

**Resolution:** unify items with split children.

- A "line item" = a split child with `category_id` = parent's category, no `debt_id`, with `description` (replaces `name`), `quantity`, `price_per_unit`.
- When the user adds items today, the form actually creates split children where every child carries the parent's category. Reports treat them identically to single-category parents because the category attribution is unchanged.
- When the user splits across categories, children diverge in `category_id`.
- Items / split children share one storage path, one editor, one validation rule.

**Migration concern:** there are no persisted items today (they're dropped on read), so there's nothing to migrate. Forward-only.

---

## 9. Form / schema changes

### 9.1 `transactionSchema` (zod)

Add fields:

```ts
is_excluded: z.boolean().default(false),
is_one_time: z.boolean().default(false),
parent_id: z.string().min(1).nullable().optional(), // set only by split flow
debt_id: z.string().min(1).nullable().optional(),
linked_transaction_id: z.string().min(1).nullable().optional(),
recurring_id: z.string().min(1).nullable().optional(), // never user-editable
```

Add refinements:

- `is_excluded && is_one_time` → reject.
- A split child (`parent_id` set) must have exactly one of `category_id` or `debt_id`.
- `debt_id` set → require account currency = debt currency.

### 9.2 `transactionItemSchema` is removed

Replaced by `splitChildSchema` (same shape plus `category_id?`, `debt_id?` with XOR).

### 9.3 `recurringSchema`

Add `created_from_transaction_id: z.string().min(1).nullable().optional()`.

### 9.4 `TransactionType` cleanup

Drop `'debt_payment' | 'debt_collection'` from the union ([src/types/transactions.ts:6](../../src/types/transactions.ts#L6)). Debt payment is a flag (`debt_id` set), not a type. Type remains `income | expense | transfer`.

---

## 10. Component boundaries

Each unit has one clear purpose and a stable interface. Internals can change without breaking callers.

| Unit | Purpose | Inputs | Outputs |
|---|---|---|---|
| `applyTransactionEffects(txn, sign)` | Apply or reverse all side-effects of a transaction | txn, ±1 | resolved promise (mutates accounts/debts) |
| `excludeExcluded / excludeOneTime / collapseLinkedPairs / expandSplitChildrenForCategoryView / excludeSplitChildren` | Pure filters | `Transaction[]` | `Transaction[]` |
| `runDueRecurring()` | Generate transactions for due templates | `Date` (now) | `number` of generated rows |
| `TransactionView page` | Display one transaction with all connections | route param `id` | rendered page |
| `SplitEditor component` | Edit split children for a parent | parent txn | onSave callback |
| `CounterpartLinkPicker component` | Find + select a counterpart candidate | source txn | onLink callback |
| `DebtPaymentPicker component` | Find + select a debt to link to | source txn | onLink callback |

The list view, edit form, and reports do NOT call `applyTransactionEffects` directly — they go through `transactionsApi.create/update/delete`, which owns the orchestration. This keeps mutation entry points down to three.

---

## 11. Testing notes

- **Filter helpers** (pure): unit tests over fixture transactions covering every flag combination.
- **`applyTransactionEffects`** (mutation): test with mocked `accountsApi.updateBalance` and `debtsApi.updateBalance`. Verify ±sign symmetry: apply(+1) then apply(-1) leaves balances unchanged.
- **Split sum validation**: zod refinement tests for sum-equals-parent within tolerance.
- **Linked pair reports**: integration test that a linked income+expense pair appears once in summary, not twice.
- **Recurring engine**: test `runDueRecurring` advances `next_run_date` correctly for daily/weekly/monthly/yearly with `interval > 1` and `day_of_week` / `day_of_month` set.
- **Manual smoke test** of every cross-section navigation link after Phase 5 ships.

---

## 12. Phasing

| Phase | Deliverable | Risk |
|---|---|---|
| **1 — Foundations** | All new schema columns. `transaction-effects.ts` refactor (no behavior change). Filter helpers. View page shell with badges + details. List badges + new filter toggles. Coercion utility. | Low. Pure additive. |
| **2 — Exclude + One-time** | Toggles on edit + view page. Apply filter chain to summary, budget `spent` (new), reports, dashboard. CSV export columns. | Medium. Touches every aggregate. |
| **3 — Split + items unification** | SplitEditor on view page. Unsplit. Children with XOR category/debt. Items → children migration. Default queries hide children; category surfaces expand. | Medium. New side-effect path through `applyTransactionEffects`. |
| **4 — Counterpart link + debt payment** | CounterpartLinkPicker. DebtPaymentPicker. Mutual link storage. Reports collapse pairs. Parent-level `debt_id` debt-balance side-effect. | Medium. |
| **5 — Recurring engine + linkage** | `runDueRecurring` on app load + "Run now" button. `recurring_id` stamped on generated rows. "From recurring" chip on transaction view. "Generated transactions" tab on recurring detail. "Create recurring from this" button + prefill route. | Low. Mostly nav once engine works. |

Each phase ships independently. Phase 1 unlocks every subsequent phase. Phases 2–5 are roughly independent and could run in parallel if needed.

---

## 13. Risks and open questions

1. **GAS string coercion of booleans**. Sheets may store `'FALSE'` (uppercase) for cells set via the UI. The `toBool` helper handles `'true'` only. Verify with real round-trip; extend helper if needed.
2. **Recurring engine load timing**. If `runDueRecurring` runs on every app load, two browser tabs opened simultaneously could both generate the same transaction. Acceptable for v1 (advancing `next_run_date` is the lock, and the second call will see it advanced). Race window is small. Worst case: occasional duplicate, easy manual fix.
3. **Backfill timing**. Don't deploy Phase 2 until the backfill script (or hand-edit) is run on production sheets. Otherwise some rows may behave inconsistently if `''` does not coerce as expected on a given client.
4. **Currency-mismatched debt payments**. Blocked in v1. Users may want FX support later — out of scope.
5. **Cascade-delete confirmation copy**. "Delete this transaction? Its N split children will also be deleted." Make sure copy is unambiguous before shipping Phase 3.

---

## 14. Glossary

- **Parent transaction** — a transaction with one or more split children. Carries the account balance hit.
- **Split child** — a row with `parent_id` set. No balance hit. Carries one of `category_id` or `debt_id`. Sums to parent's `amount`.
- **Linked counterpart** — two standalone transactions whose `linked_transaction_id` points at each other. Represents a reconciled transfer pair.
- **Debt payment** — a transaction (or split child) with `debt_id` set. Reduces that debt's balance.
- **Excluded** — a transaction with `is_excluded = true`. Hidden from every aggregate; account balance still counts it.
- **One-time** — a transaction with `is_one_time = true`. Counted in raw historical totals; hidden from averages, budgets, projections.
- **Generated transaction** — a transaction created by the recurring engine. Carries `recurring_id`.
- **Spawned recurring** — a recurring template created via "Create recurring from this." Carries `created_from_transaction_id`.
