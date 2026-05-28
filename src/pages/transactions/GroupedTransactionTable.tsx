import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Link2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CategoryPill } from "@/components/shared";
import { AmountText } from "@/components/shared/AmountText";
import { CategoryIcon } from "@/lib/category-icon";
import { TransactionActionMenu } from "./TransactionActionMenu";
import { Transaction } from "@/types";
import { cn } from "@/lib/utils";

interface GroupedTransactionTableProps {
  transactions: Transaction[];
  selectedIds: Set<string>;
  onSelectId: (id: string, checked: boolean) => void;
  onSelectGroup: (ids: string[], checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete: (id: string, opts?: { skipEffects?: boolean }) => void;
  onDuplicate: (id: string) => void;
  showCheckboxes?: boolean;
}

// Only income/expense transactions participate in selection
function isSelectable(t: Transaction) {
  return t.type !== "transfer";
}

// Group transactions by date, preserving order
function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const existing = map.get(t.date);
    if (existing) {
      existing.push(t);
    } else {
      map.set(t.date, [t]);
    }
  }
  return Array.from(map.entries());
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTransactionLabel(t: Transaction): string {
  if (t.description) return t.description;
  if (t.type === "transfer") {
    return `${t.account.name} → ${t.toAccount?.name ?? ""}`;
  }
  return t.category?.name ?? "—";
}

function getAvatarLetter(t: Transaction): string {
  const label = getTransactionLabel(t);
  return label.charAt(0).toUpperCase();
}

export function GroupedTransactionTable({
  transactions,
  selectedIds,
  onSelectId,
  onSelectGroup,
  onSelectAll,
  onDelete,
  onDuplicate,
  showCheckboxes = true,
}: GroupedTransactionTableProps) {
  const GRID = showCheckboxes
    ? "grid grid-cols-[40px_1fr_140px] md:grid-cols-[40px_1fr_180px_140px]"
    : "grid grid-cols-[1fr_140px] md:grid-cols-[40px_1fr_180px_140px]";
  const checkboxCellClass = showCheckboxes
    ? "flex items-center justify-center"
    : "hidden md:flex items-center justify-center";
  const navigate = useNavigate();

  const groups = useMemo(() => groupByDate(transactions), [transactions]);
  const allSelectable = useMemo(
    () => transactions.filter(isSelectable),
    [transactions],
  );

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No transactions found
      </div>
    );
  }
  const allSelected =
    allSelectable.length > 0 &&
    allSelectable.every((t) => selectedIds.has(t.id));
  const someSelected = allSelectable.some((t) => selectedIds.has(t.id));

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Global header row */}
      <div
        className={cn(
          GRID,
          "items-center px-0 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide",
        )}
      >
        <div className={checkboxCellClass}>
          <Checkbox
            checked={
              allSelected ? true : someSelected ? "indeterminate" : false
            }
            onCheckedChange={(checked) => onSelectAll(checked === true)}
            aria-label="Select all transactions"
          />
        </div>
        <div className="pl-2">Transaction</div>
        <div className="hidden sm:block">Category</div>
        <div className="text-right pr-3">Amount</div>
        <div />
      </div>

      {/* Date groups */}
      {groups.map(([date, groupTxns]) => {
        const selectableInGroup = groupTxns.filter(isSelectable);
        const groupAllSelected =
          selectableInGroup.length > 0 &&
          selectableInGroup.every((t) => selectedIds.has(t.id));
        const groupSomeSelected = selectableInGroup.some((t) =>
          selectedIds.has(t.id),
        );

        // Group net total: income - expense (transfers excluded)
        const groupTotal = groupTxns.reduce((sum, t) => {
          if (t.type === "income") return sum + t.amount;
          if (t.type === "expense") return sum - t.amount;
          return sum;
        }, 0);

        const refTxn = groupTxns[0];
        const groupCurrency = refTxn.account.currency?.symbol ?? "";
        const groupDecimals = refTxn.account.currency?.decimals ?? 2;

        const hasMixedCurrencies = groupTxns.some(
          (t) =>
            (t.account.currency?.symbol ?? "") !==
            (groupTxns[0]?.account.currency?.symbol ?? ""),
        );

        const sortedGroupTxns = [...groupTxns].sort((a, b) => {
          const aStamp = a.createdAt ?? `${a.date}T00:00:00.000Z`;
          const bStamp = b.createdAt ?? `${b.date}T00:00:00.000Z`;
          return aStamp < bStamp ? 1 : aStamp > bStamp ? -1 : 0;
        });

        return (
          <div key={date} className="p-2 bg-[#242424] m-2 rounded-lg">
            {/* Group header row */}
            <div
              className={cn(
                GRID,
                "items-center py-2 bg-muted/30 text-sm font-semibold",
              )}
            >
              <div className={checkboxCellClass}>
                <Checkbox
                  checked={
                    groupAllSelected
                      ? true
                      : groupSomeSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    onSelectGroup(
                      selectableInGroup.map((t) => t.id),
                      checked === true,
                    )
                  }
                  aria-label={`Select all transactions for ${date}`}
                />
              </div>
              <div className="pl-2 text-foreground flex-nowrap">
                {formatGroupDate(date)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {groupTxns.length}{" "}
                </span>
              </div>
              <div className="hidden sm:block" />
              <div className="text-right pr-3">
                {hasMixedCurrencies ? (
                  <span className="text-right text-sm text-muted-foreground">
                    —
                  </span>
                ) : (
                  <AmountText
                    value={groupTotal}
                    decimals={groupDecimals}
                    currency={groupCurrency}
                    signDisplay="always"
                    className={cn(
                      "text-sm font-semibold",
                      groupTotal > 0
                        ? "text-green-600"
                        : groupTotal < 0
                          ? "text-red-600"
                          : "text-muted-foreground",
                    )}
                  />
                )}
              </div>
              {/* <div /> */}
            </div>

            <div className="bg-[#171717] rounded-lg">
              {/* Transaction rows */}
              {sortedGroupTxns.map((t) => {
                const isTransfer = t.type === "transfer";
                const isIncome = t.type === "income";
                const label = getTransactionLabel(t);
                const decimals = t.account.currency?.decimals ?? 2;
                const currency = t.account.currency?.symbol ?? "";

                const amountValue = isIncome ? t.amount : -t.amount;
                const amountColor = isIncome
                  ? "text-green-600"
                  : isTransfer
                    ? "text-blue-500"
                    : "text-red-600";

                return (
                  <div
                    key={t.id}
                    className={cn(
                      GRID,
                      "items-center py-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/20 transition-colors",
                      t.isExcluded && "opacity-60",
                    )}
                    onClick={() => navigate(`/transactions/${t.id}`)}
                  >
                    {/* Checkbox cell */}
                    <div
                      className={checkboxCellClass}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isTransfer ? (
                        <span className="size-4" />
                      ) : (
                        <Checkbox
                          checked={selectedIds.has(t.id)}
                          onCheckedChange={(checked) =>
                            onSelectId(t.id, checked === true)
                          }
                          aria-label={`Select ${label}`}
                        />
                      )}
                    </div>

                    {/* Description + account + badges */}
                    <div className="pl-2 flex items-start gap-2 min-w-0">
                      {/* Avatar: category icon on colored bg, fallback to letter */}
                      <div
                        className="size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: t.category?.color
                            ? `${t.category.color}30`
                            : undefined,
                        }}
                      >
                        {t.category ? (
                          <span style={{ color: t.category.color }}>
                            <CategoryIcon name={t.category.icon} size={16} />
                          </span>
                        ) : (
                          <div className="size-8 rounded-full bg-muted text-xs font-bold uppercase flex items-center justify-center">
                            {label.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Main label + inline badges */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            className="font-medium text-sm"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {label}
                          </span>
                          {/* Inline badges */}
                          {(t.linkedTransactionId ||
                            !t.isApproved ||
                            t.isExcluded ||
                            t.recurringId ||
                            t.debtId) && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              {t.linkedTransactionId && (
                                <span title="Linked counterpart">
                                  <Link2 className="size-3" />
                                </span>
                              )}
                              {!t.isApproved && (
                                <span
                                  title="Pending approval"
                                  className="text-amber-600"
                                >
                                  ⏳
                                </span>
                              )}
                              {t.isExcluded && <span title="Excluded">⊘</span>}
                              {t.recurringId && (
                                <span title="From recurring">↻</span>
                              )}
                              {t.debtId && <span title="Debt payment">$</span>}
                            </span>
                          )}
                        </div>

                        {/* Sub-line: category (mobile only) · account */}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.category && (
                            <span className="sm:hidden">
                              {t.category.name}
                              <span className="mx-1">·</span>
                            </span>
                          )}
                          {t.account.name}
                        </div>

                        {/* Tags */}
                        {t.tags && t.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-xs px-1.5 py-0 text-muted-foreground"
                              >
                                #{tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category cell — hidden on mobile */}
                    <div className="hidden sm:flex items-center">
                      {t.category ? (
                        <CategoryPill
                          name={t.category.name}
                          icon={t.category.icon}
                          color={t.category.color}
                          size="sm"
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>

                    {/* Amount cell */}
                    <div className="flex items-center justify-end gap-1 pr-3">
                      {!t.isApproved && (
                        <Lock className="size-3 text-muted-foreground shrink-0" />
                      )}

                      {isTransfer && t.toAmount && t.toAccount ? (
                        <div className="text-xs flex items-center flex-col text-muted-foreground font-mono ml-1">
                          <AmountText
                            value={amountValue}
                            decimals={decimals}
                            currency={currency}
                            signDisplay="always"
                            className={cn("text-sm font-semibold", amountColor)}
                          />
                          {/* →{" "} //downarrow character below like this but down → */}
                          ↓
                          <AmountText
                            value={t.toAmount}
                            decimals={t.toAccount.currency?.decimals ?? 2}
                            currency={t.toAccount.currency?.symbol ?? ""}
                            signDisplay="always"
                          />
                        </div>
                      ) : (
                        <AmountText
                          value={amountValue}
                          decimals={decimals}
                          currency={currency}
                          signDisplay="always"
                          className={cn("text-sm font-semibold", amountColor)}
                        />
                      )}
                      <div
                        className="flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TransactionActionMenu
                          transaction={t}
                          onDelete={onDelete}
                          onDuplicate={onDuplicate}
                        />
                      </div>
                    </div>

                    {/* Action menu cell */}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
