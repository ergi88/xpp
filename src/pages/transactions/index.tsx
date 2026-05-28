import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useQueryStates,
  parseAsInteger,
  parseAsString,
  parseAsArrayOf,
  parseAsStringLiteral,
  parseAsBoolean,
} from "nuqs";
import { Plus, Download, Search, CheckSquare, Square } from "lucide-react";
import {
  Page,
  PageHeader,
  ReconcileAllDialog,
  ServerPagination,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TransactionWidgets } from "./TransactionWidgets";
import { FilterPopover, type FilterState } from "./FilterPopover";
import { GroupedTransactionTable } from "./GroupedTransactionTable";
import { BulkActionBar } from "./BulkActionBar";
import {
  useTransactions,
  useDeleteTransaction,
  useDuplicateTransaction,
  useCategories,
  useTags,
  useAccounts,
  useBulkDeleteTransactions,
  useBulkUpdateTransactions,
} from "@/hooks";
import { firstDayOfCurrentMonth, getDateRange } from "./dateNavHelpers";
import RecurringPage from "@/pages/recurring";
import DebtsPage from "@/pages/debts";

const transactionSearchParams = {
  sortBy: parseAsStringLiteral([
    "date",
    "amount",
    "created_at",
  ] as const).withDefault("date"),
  sortDir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  page: parseAsInteger.withDefault(1),
  categoryIds: parseAsArrayOf(parseAsString).withDefault([]),
  tagIds: parseAsArrayOf(parseAsString).withDefault([]),
  accountIds: parseAsArrayOf(parseAsString).withDefault([]),
  types: parseAsArrayOf(
    parseAsStringLiteral(["income", "expense", "transfer"] as const),
  ).withDefault([]),
  showExcluded: parseAsBoolean.withDefault(false),
  showSplitChildren: parseAsBoolean.withDefault(false),
  navDate: parseAsString.withDefault(firstDayOfCurrentMonth()),
  amountMin: parseAsString.withDefault(""),
  amountMax: parseAsString.withDefault(""),
};

const PER_PAGE = 20;

export default function TransactionsPage() {
  const [params, setParams] = useQueryStates(transactionSearchParams);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("transactions");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // Fetch the full month worth of transactions
  const monthDateRange = getDateRange("month", params.navDate);
  const hasCategoryFilter = params.categoryIds.length > 0;

  const fetchFilters = {
    per_page: 9999,
    page: 1,
    sort_by: params.sortBy,
    sort_direction: params.sortDir,
    start_date: monthDateRange.start_date,
    end_date: monthDateRange.end_date,
    include_excluded: params.showExcluded,
    include_split_children: params.showSplitChildren || hasCategoryFilter,
  };

  const { data, isLoading } = useTransactions(fetchFilters);
  const deleteTransaction = useDeleteTransaction();
  const duplicateTransaction = useDuplicateTransaction();
  const bulkDelete = useBulkDeleteTransactions();
  const bulkUpdate = useBulkUpdateTransactions();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: accountsData } = useAccounts({ active: true });
  const accounts = accountsData ?? [];

  // Client-side filtering
  let filtered = data?.data ?? [];

  if (params.types.length > 0) {
    filtered = filtered.filter((t) => params.types.includes(t.type));
  }
  if (params.accountIds.length > 0) {
    filtered = filtered.filter(
      (t) => t.account && params.accountIds.includes(t.account.id),
    );
  }
  if (params.categoryIds.length > 0) {
    // Drop parents that have children — children carry the real attribution
    const parentIdsWithChildren = new Set<string>();
    for (const t of filtered) {
      if (!t.parentId && t.children && t.children.length > 0) {
        parentIdsWithChildren.add(t.id);
      }
    }
    filtered = filtered.filter(
      (t) =>
        !parentIdsWithChildren.has(t.id) &&
        t.category &&
        params.categoryIds.includes(t.category.id),
    );
  }
  if (params.tagIds.length > 0) {
    filtered = filtered.filter((t) =>
      t.tags.some((tag) => params.tagIds.includes(tag.id)),
    );
  }
  if (params.amountMin) {
    const min = Number(params.amountMin);
    if (!Number.isNaN(min)) {
      filtered = filtered.filter((t) => t.amount >= min);
    }
  }
  if (params.amountMax) {
    const max = Number(params.amountMax);
    if (!Number.isNaN(max)) {
      filtered = filtered.filter((t) => t.amount <= max);
    }
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
        t.account.name.toLowerCase().includes(q) ||
        (t.category?.name ?? "").toLowerCase().includes(q),
    );
  }

  // Client-side pagination
  const totalCount = filtered.length;
  const transactions = filtered.slice(
    (params.page - 1) * PER_PAGE,
    params.page * PER_PAGE,
  );

  const transactionsRef = useRef<typeof transactions>([]);
  transactionsRef.current = transactions;
  const meta =
    totalCount > 0
      ? {
          current_page: params.page,
          last_page: Math.ceil(totalCount / PER_PAGE),
          per_page: PER_PAGE,
          total: totalCount,
          from: (params.page - 1) * PER_PAGE + 1,
          to: Math.min(params.page * PER_PAGE, totalCount),
        }
      : undefined;

  // Clear selection when page/filters/tab change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    params.page,
    params.categoryIds,
    params.tagIds,
    params.accountIds,
    params.types,
    params.showExcluded,
    params.showSplitChildren,
    params.amountMin,
    params.amountMax,
    params.navDate,
    activeTab,
    search,
  ]);

  // Selection handlers
  const handleSelectId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectGroup = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of ids) next.add(id);
      } else {
        for (const id of ids) next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const selectable = transactionsRef.current
        .filter((t) => t.type === "income" || t.type === "expense")
        .map((t) => t.id);
      setSelectedIds(() => (checked ? new Set(selectable) : new Set()));
    },
    [], // stable - reads from ref
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // FilterPopover current state
  const currentFilters: FilterState = {
    accountIds: params.accountIds,
    categoryIds: params.categoryIds,
    tagIds: params.tagIds,
    types: params.types,
    showExcluded: params.showExcluded,
    showSplitChildren: params.showSplitChildren,
    amountMin: params.amountMin,
    amountMax: params.amountMax,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  };

  const handleApplyFilters = useCallback(
    (f: FilterState) => {
      setParams({
        accountIds: f.accountIds.length ? f.accountIds : null,
        categoryIds: f.categoryIds.length ? f.categoryIds : null,
        tagIds: f.tagIds.length ? f.tagIds : null,
        types: f.types.length ? f.types : null,
        showExcluded: f.showExcluded || null,
        showSplitChildren: f.showSplitChildren || null,
        amountMin: f.amountMin || null,
        amountMax: f.amountMax || null,
        sortBy: f.sortBy,
        sortDir: f.sortDir,
        page: 1,
      });
    },
    [setParams],
  );

  const totalSelectableCount = useMemo(
    () => transactions.filter((t) => t.type !== "transfer").length,
    [transactions],
  );

  return (
    <Page title="Transactions">
      <PageHeader
        title="Transactions"
        actions={
          <div className="flex items-center gap-2">
            <ReconcileAllDialog />
            <Button variant="outline" size="sm" asChild>
              <Link to="/transactions/import">
                <Download className="size-4 mr-2" />
                Import
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/transactions/create">
                <Plus className="size-4 mr-2" />
                New transaction
              </Link>
            </Button>
          </div>
        }
      />

      {/* Widgets row */}
      <div className="mb-2">
        <TransactionWidgets />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} mode="default">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="debts">Debts</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          {/* Search + Filter row */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions…"
                className="pl-9 h-10"
              />
            </div>
            <FilterPopover
              filters={currentFilters}
              accounts={accounts}
              categories={categories ?? []}
              tags={tags ?? []}
              onApply={handleApplyFilters}
            />
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0 h-10 w-10"
              title={showCheckboxes ? "Hide checkboxes" : "Show checkboxes"}
              onClick={() => setShowCheckboxes((v) => !v)}
            >
              {showCheckboxes ? (
                <CheckSquare className="size-5" />
              ) : (
                <Square className="size-5" />
              )}
            </Button>
          </div>

          {/* Grouped table */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : (
            <GroupedTransactionTable
              transactions={transactions}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectGroup={handleSelectGroup}
              onSelectAll={handleSelectAll}
              onDelete={(id, opts) =>
                deleteTransaction.mutate({ id, skipEffects: opts?.skipEffects })
              }
              onDuplicate={(id) => duplicateTransaction.mutate(id)}
              showCheckboxes={showCheckboxes}
            />
          )}

          {meta && (
            <ServerPagination
              meta={meta}
              onPageChange={(page) => setParams({ page })}
              infoLabel="transactions"
            />
          )}
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringPage />
        </TabsContent>

        <TabsContent value="debts">
          <DebtsPage />
        </TabsContent>
      </Tabs>

      {/* Floating bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalSelectableCount={totalSelectableCount}
        onClearSelection={handleClearSelection}
        onBulkDelete={() => {
          bulkDelete.mutate(Array.from(selectedIds), {
            onSuccess: () => setSelectedIds(new Set()),
          });
        }}
        onBulkEdit={({ categoryId, isOneTime, isExcluded }) => {
          const data: Record<string, unknown> = {};
          if (categoryId) data.category_id = categoryId;
          if (isOneTime !== null && isOneTime !== undefined)
            data.is_one_time = isOneTime;
          if (isExcluded !== null && isExcluded !== undefined)
            data.is_excluded = isExcluded;
          if (Object.keys(data).length === 0) return;
          bulkUpdate.mutate(
            { ids: Array.from(selectedIds), data },
            { onSuccess: () => setSelectedIds(new Set()) },
          );
        }}
      />
    </Page>
  );
}
