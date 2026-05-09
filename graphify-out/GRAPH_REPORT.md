# Graph Report - /Users/ergiasllani/CREATIONS/xpp  (2026-05-09)

## Corpus Check
- Large corpus: 254 files · ~87,036 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 607 nodes · 494 edges · 20 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Accounts API Layer|Accounts API Layer]]
- [[_COMMUNITY_Account Pages & Display|Account Pages & Display]]
- [[_COMMUNITY_Google Sheets Adapter|Google Sheets Adapter]]
- [[_COMMUNITY_Authentication & Security|Authentication & Security]]
- [[_COMMUNITY_Transaction Date Navigation|Transaction Date Navigation]]
- [[_COMMUNITY_Debt Management|Debt Management]]
- [[_COMMUNITY_Setup Connection Wizard|Setup Connection Wizard]]
- [[_COMMUNITY_Offline Mutation Queue|Offline Mutation Queue]]
- [[_COMMUNITY_Tag Management|Tag Management]]
- [[_COMMUNITY_Recurring Transactions|Recurring Transactions]]
- [[_COMMUNITY_Category Management|Category Management]]
- [[_COMMUNITY_Currency Management|Currency Management]]
- [[_COMMUNITY_Setup Currency & Theme|Setup Currency & Theme]]
- [[_COMMUNITY_Budget Management|Budget Management]]
- [[_COMMUNITY_Transaction Management|Transaction Management]]
- [[_COMMUNITY_Auth Context & Provider|Auth Context & Provider]]
- [[_COMMUNITY_CSV Import Wizard|CSV Import Wizard]]
- [[_COMMUNITY_Dashboard|Dashboard]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 38|Community 38]]

## God Nodes (most connected - your core abstractions)
1. `get()` - 12 edges
2. `Header()` - 6 edges
3. `fmt()` - 6 edges
4. `groupBy()` - 6 edges
5. `getThemeSnapshot()` - 5 edges
6. `sha256()` - 5 edges
7. `syncAll()` - 5 edges
8. `flushMutationQueue()` - 5 edges
9. `DateNavBlock()` - 5 edges
10. `useAuth()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `enrichAccountWithCurrency()` --calls--> `get()`  [INFERRED]
  /Users/ergiasllani/CREATIONS/xpp/src/lib/currency.ts → /Users/ergiasllani/CREATIONS/xpp/src/lib/sheets/gas-adapter.ts
- `enrichAccount()` --calls--> `get()`  [INFERRED]
  /Users/ergiasllani/CREATIONS/xpp/src/api/accounts.ts → /Users/ergiasllani/CREATIONS/xpp/src/lib/sheets/gas-adapter.ts
- `toDebt()` --calls--> `get()`  [INFERRED]
  /Users/ergiasllani/CREATIONS/xpp/src/api/debts.ts → /Users/ergiasllani/CREATIONS/xpp/src/lib/sheets/gas-adapter.ts
- `Header()` --calls--> `useAuth()`  [INFERRED]
  /Users/ergiasllani/CREATIONS/xpp/src/components/layout/Header.tsx → /Users/ergiasllani/CREATIONS/xpp/src/auth/AuthContext.tsx
- `handlePin()` --calls--> `sha256()`  [INFERRED]
  /Users/ergiasllani/CREATIONS/xpp/src/auth/lock-screen/LockScreen.tsx → /Users/ergiasllani/CREATIONS/xpp/src/lib/auth.ts

## Communities

### Community 0 - "Accounts API Layer"
Cohesion: 0.08
Nodes (21): enrichAccount(), formatExpiryDate(), getBaseCurrencyMeta(), isAccountIncludedInBaseAggregates(), loadCurrencyContext(), normalizeCardExpiry(), normalizeCardLastDigits(), parseSpreadsheetDate() (+13 more)

### Community 1 - "Account Pages & Display"
Cohesion: 0.1
Nodes (16): AmountText(), AccountCreatePage(), AccountEditPage(), Header(), AccountsPage(), formatMoney(), formatNumber(), useAccount() (+8 more)

### Community 2 - "Google Sheets Adapter"
Cohesion: 0.14
Nodes (18): get(), post(), url(), toRecurring(), computeActivityHeatmap(), computeByCategory(), computeCashFlow(), computeDynamics() (+10 more)

### Community 3 - "Authentication & Security"
Cohesion: 0.11
Nodes (14): clearAuthStorage(), registerWebAuthn(), sha256(), sha256Pure(), verifyWebAuthn(), handleReset(), handlePin(), handleWebAuthn() (+6 more)

### Community 4 - "Transaction Date Navigation"
Cohesion: 0.14
Nodes (9): DateNavBlock(), formatPeriod(), getAccountLabel(), getNavLabel(), getNavValue(), stepDay(), stepMonth(), handleNavNext() (+1 more)

### Community 5 - "Debt Management"
Cohesion: 0.14
Nodes (5): DebtCreatePage(), DebtEditPage(), useCreateDebt(), useDebt(), useUpdateDebt()

### Community 6 - "Setup Connection Wizard"
Cohesion: 0.15
Nodes (3): fallbackCopy(), handleCopy(), Select()

### Community 8 - "Offline Mutation Queue"
Cohesion: 0.27
Nodes (9): dequeue(), enqueue(), getQueue(), addSyncError(), clearSyncErrors(), flushMutationQueue(), getSyncErrors(), setLastSyncTime() (+1 more)

### Community 9 - "Tag Management"
Cohesion: 0.2
Nodes (8): CreateTagPage(), TagEditPage(), TagsPage(), useCreateTag(), useDeleteTag(), useTag(), useTags(), useUpdateTag()

### Community 10 - "Recurring Transactions"
Cohesion: 0.2
Nodes (6): RecurringCreatePage(), RecurringPage(), useCreateRecurring(), useDeleteRecurring(), useRecurring(), useSkipRecurring()

### Community 11 - "Category Management"
Cohesion: 0.2
Nodes (5): CategoryCreatePage(), CategoriesPage(), useCategories(), useCreateCategory(), useDeleteCategory()

### Community 12 - "Currency Management"
Cohesion: 0.22
Nodes (6): CurrencyCreatePage(), CurrenciesPage(), useCreateCurrency(), useCurrencies(), useDeleteCurrency(), useSetBaseCurrency()

### Community 13 - "Setup Currency & Theme"
Cohesion: 0.29
Nodes (8): CurrencyStep(), applyTheme(), getThemeSnapshot(), initTheme(), notifyThemeChange(), resolveTheme(), setThemeValue(), useTheme()

### Community 15 - "Budget Management"
Cohesion: 0.22
Nodes (5): BudgetCreatePage(), BudgetsPage(), useBudgets(), useCreateBudget(), useDeleteBudget()

### Community 16 - "Transaction Management"
Cohesion: 0.2
Nodes (2): TransactionCreatePage(), useCreateTransaction()

### Community 17 - "Auth Context & Provider"
Cohesion: 0.25
Nodes (3): useAuth(), AuthGateInner(), useActivityTracker()

### Community 20 - "CSV Import Wizard"
Cohesion: 0.33
Nodes (2): SidebarMenuButton(), useSidebar()

### Community 21 - "Dashboard"
Cohesion: 0.33
Nodes (2): formatDateLocal(), getPresetDates()

### Community 22 - "Community 22"
Cohesion: 0.47
Nodes (3): formatYearMonth(), getCurrentMonth(), getMonthOptions()

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (2): canGoToStep(), handleStepChange()

## Knowledge Gaps
- **Thin community `Transaction Management`** (10 nodes): `TransactionCreatePage()`, `use-transactions.ts`, `create.tsx`, `useCreateTransaction()`, `useDeleteTransaction()`, `useDuplicateTransaction()`, `useTransaction()`, `useTransactions()`, `useTransactionSummary()`, `useUpdateTransaction()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CSV Import Wizard`** (7 nodes): `cn()`, `handleKeyDown()`, `SidebarMenu()`, `SidebarMenuButton()`, `SidebarMenuItem()`, `useSidebar()`, `sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard`** (7 nodes): `formatDate()`, `formatDateLocal()`, `getPresetDates()`, `getTransactionColor()`, `getTransactionSign()`, `handlePeriodChange()`, `dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (3 nodes): `canGoToStep()`, `handleStepChange()`, `CsvImportWizard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get()` connect `Google Sheets Adapter` to `Accounts API Layer`, `Authentication & Security`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `verifyWebAuthn()` connect `Authentication & Security` to `Google Sheets Adapter`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `enrichAccount()` connect `Accounts API Layer` to `Google Sheets Adapter`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `get()` (e.g. with `enrichAccountWithCurrency()` and `verifyWebAuthn()`) actually correct?**
  _`get()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Header()` (e.g. with `useAuth()` and `useHideAmounts()`) actually correct?**
  _`Header()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Accounts API Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Account Pages & Display` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._