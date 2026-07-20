import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  EyeOff,
  RotateCcw,
  Tag as TagIcon,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAccounts, useCategories, useTags, useBulkCreateTransactions } from "@/hooks";
import { transactionSchema, type TransactionFormValues } from "@/schemas";
import { AccountSelect } from "@/components/shared/AccountSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StickyFooterActions } from "@/components/shared/StickyFooterActions";
import { BottomSheet, type BottomSheetItem } from "@/components/ui/bottom-sheet";
import type { Account } from "@/types/accounts";
import type { DraftType, ParsedDraft } from "./types";

interface Props {
  drafts: ParsedDraft[];
  /** Called with the line indices that saved successfully so the caller can
   *  strip them from the source page. */
  onSaved: (savedLineIndices: number[]) => void;
  /** Called when the batch is fully saved (nothing left to review). */
  onDone: () => void;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

const TYPE_META: Record<
  DraftType,
  { label: string; icon: typeof ArrowUpRight; tint: string; sign: string }
> = {
  income: {
    label: "Income",
    icon: ArrowDownLeft,
    tint: "text-emerald-600 dark:text-emerald-400",
    sign: "+",
  },
  expense: {
    label: "Expense",
    icon: ArrowUpRight,
    tint: "text-rose-600 dark:text-rose-400",
    sign: "−",
  },
  transfer: {
    label: "Transfer",
    icon: ArrowLeftRight,
    tint: "text-sky-600 dark:text-sky-400",
    sign: "",
  },
};

/** Map an editable draft to the shape the API + schema expect. */
function toFormValues(
  d: ParsedDraft,
  date: string,
  accounts: Account[] | undefined,
): TransactionFormValues {
  const from = accounts?.find((a) => a.id === d.accountId);
  const to = accounts?.find((a) => a.id === d.toAccountId);

  // Cross-currency transfer: seed to_amount + rate from currency defaults,
  // mirroring TransactionForm. Same-currency leaves them null (backend falls
  // back to the send amount).
  let toAmount: number | null = null;
  let rate: number | null = null;
  if (
    d.type === "transfer" &&
    from?.currency &&
    to?.currency &&
    from.currency.id !== to.currency.id &&
    from.currency.rate > 0
  ) {
    rate = to.currency.rate / from.currency.rate;
    const factor = Math.pow(10, to.currency.decimals ?? 2);
    toAmount = Math.round(d.amount * rate * factor) / factor;
    rate = Math.round(rate * 1e6) / 1e6;
  }

  return {
    type: d.type,
    account_id: d.accountId ?? "",
    to_account_id: d.type === "transfer" ? d.toAccountId : null,
    category_id: d.type === "transfer" ? null : d.categoryId,
    amount: d.amount,
    to_amount: toAmount,
    exchange_rate: rate,
    description: d.description || undefined,
    date,
    tag_ids: d.tagIds,
    is_excluded: false,
    is_one_time: false,
  };
}

function isDraftValid(
  d: ParsedDraft,
  date: string,
  accounts: Account[] | undefined,
): boolean {
  return transactionSchema.safeParse(toFormValues(d, date, accounts)).success;
}

export function TransactionReview({ drafts: initial, onSaved, onDone }: Props) {
  const { data: accounts } = useAccounts({ active: true, exclude_debts: true });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const bulkCreate = useBulkCreateTransactions();

  // `active` = will be saved and counted. Lines already created start inactive.
  type Row = ParsedDraft & { active: boolean };
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((d) => ({ ...d, active: !d.created })),
  );
  const [batchAccountId, setBatchAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const firstActive = initial.find((d) => !d.created);
    return initial.filter((d) => !d.created).length === 1
      ? (firstActive?.id ?? null)
      : null;
  });
  const [tagSheetFor, setTagSheetFor] = useState<string | null>(null);

  const patch = (id: string, next: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const setActive = (id: string, active: boolean) => {
    patch(id, { active });
    if (!active) setExpandedId((cur) => (cur === id ? null : cur));
  };

  // Apply the batch account only to rows that will be saved.
  const applyAccountToAll = (accountId: string) => {
    setBatchAccountId(accountId);
    setRows((prev) =>
      prev.map((r) => (r.active ? { ...r, accountId } : r)),
    );
  };

  // Active rows first (keeping order); inactive (created / hidden) sink down.
  const ordered = useMemo(
    () => [...rows].sort((a, b) => Number(b.active) - Number(a.active)),
    [rows],
  );
  const activeRows = rows.filter((r) => r.active);

  const validById = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of activeRows) m.set(r.id, isDraftValid(r, date, accounts));
    return m;
  }, [activeRows, date, accounts]);
  const invalidCount = activeRows.filter((r) => !validById.get(r.id)).length;
  const canSave =
    activeRows.length > 0 && invalidCount === 0 && !bulkCreate.isPending;

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, transfer: 0 };
    for (const r of activeRows) t[r.type] += 1;
    return t;
  }, [activeRows]);

  const handleSave = async () => {
    const toSave = rows.filter((r) => r.active);
    const payload = toSave.map((r) => toFormValues(r, date, accounts));
    const results = await bulkCreate.mutateAsync(payload);

    const okIds = new Set<string>();
    const savedLineIndices: number[] = [];
    results.forEach((res) => {
      const row = toSave[res.index];
      if (res.ok) {
        okIds.add(row.id);
        savedLineIndices.push(row.lineIndex);
      }
    });
    onSaved(savedLineIndices);

    if (results.every((r) => r.ok)) {
      onDone();
      return;
    }
    // Partial failure: flip the saved rows to created+inactive (they sink and
    // show a "Created" badge); leave the failed ones active to fix and retry.
    setRows((prev) =>
      prev.map((r) =>
        okIds.has(r.id) ? { ...r, active: false, created: true } : r,
      ),
    );
  };

  const tagItems: BottomSheetItem[] = (tags ?? []).map((t) => ({
    id: t.id,
    label: t.name,
    iconNode: <TagIcon className="size-4 text-muted-foreground" />,
  }));

  const activeTagRow = rows.find((r) => r.id === tagSheetFor);

  return (
    <div className="mx-auto max-w-2xl pb-28">
      {/* Summary */}
      <p className="mb-3 text-sm text-muted-foreground">
        {activeRows.length} to save
        {totals.expense > 0 && ` · ${totals.expense} expense`}
        {totals.income > 0 && ` · ${totals.income} income`}
        {totals.transfer > 0 && ` · ${totals.transfer} transfer`}
        {rows.length - activeRows.length > 0 &&
          ` · ${rows.length - activeRows.length} skipped`}
      </p>

      {/* Batch controls */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/40 p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
            ACCOUNT · APPLY TO ALL
          </div>
          <AccountSelect value={batchAccountId} onChange={applyAccountToAll} />
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-3">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
            <Calendar className="size-3" />
            DATE · APPLY TO ALL
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2.5">
        {ordered.map((row) => {
          const meta = TYPE_META[row.type];
          const Icon = meta.icon;
          const account = accounts?.find((a) => a.id === row.accountId);
          const category = categories?.find((c) => c.id === row.categoryId);
          const expanded = row.active && expandedId === row.id;
          const valid = row.active ? (validById.get(row.id) ?? true) : true;

          // Inactive rows (already created, or hidden by the user) render as a
          // muted, non-editable strip with a re-include action.
          if (!row.active) {
            return (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 opacity-70"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/60">
                  <Icon className={cn("size-4", meta.tint)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                      {meta.sign}
                      {row.amount}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide",
                        row.created
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {row.created && <CheckCircle2 className="size-2.5" />}
                      {row.created ? "CREATED" : "HIDDEN"}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground/70">
                    {row.type === "transfer"
                      ? `→ ${accounts?.find((a) => a.id === row.toAccountId)?.name ?? "—"}`
                      : (category?.name ?? "No category")}
                    {account ? ` · ${account.name}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => setActive(row.id, true)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  <RotateCcw className="size-3.5" />
                  {row.created ? "Add again" : "Include"}
                </button>
              </div>
            );
          }

          return (
            <div
              key={row.id}
              className={cn(
                "rounded-2xl border bg-card/40 p-3 transition",
                valid ? "border-border" : "border-destructive/60",
              )}
            >
              {/* Summary row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/60">
                    <Icon className={cn("size-4", meta.tint)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("text-sm font-semibold tabular-nums", meta.tint)}>
                        {meta.sign}
                        {row.amount}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.type === "transfer"
                          ? `→ ${accounts?.find((a) => a.id === row.toAccountId)?.name ?? "—"}`
                          : (category?.name ?? "No category")}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground/70">
                      {account?.name ?? "No account"}
                      {row.description ? ` · ${row.description}` : ""}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                <button
                  onClick={() => setActive(row.id, false)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Hide row (skip from this batch)"
                  title="Skip — moves to the bottom, not counted"
                >
                  <EyeOff className="size-4" />
                </button>
              </div>

              {/* Expanded editor */}
              {expanded && (
                <div className="mt-3 space-y-2.5 border-t border-border pt-3">
                  {/* Type toggle */}
                  <div className="flex gap-1 rounded-xl border border-border bg-background/40 p-1">
                    {(Object.keys(TYPE_META) as DraftType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          patch(row.id, {
                            type: t,
                            toAccountId: t === "transfer" ? row.toAccountId : null,
                            categoryId: t === "transfer" ? null : row.categoryId,
                          })
                        }
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs font-medium transition",
                          row.type === t
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {TYPE_META[t].label}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div className="rounded-xl border border-border bg-background/40 p-2.5">
                    <div className="mb-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      AMOUNT
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) =>
                        patch(row.id, { amount: Number(e.target.value) || 0 })
                      }
                      className="h-8 border-0 bg-transparent p-0 text-lg font-light tabular-nums shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {/* Account */}
                  <div className="rounded-xl border border-border bg-background/40 p-2.5">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      <Wallet className="size-3" />
                      {row.type === "transfer" ? "FROM ACCOUNT" : "ACCOUNT"}
                    </div>
                    <AccountSelect
                      value={row.accountId}
                      onChange={(id) => patch(row.id, { accountId: id })}
                    />
                  </div>

                  {/* To-account (transfer) or Category */}
                  {row.type === "transfer" ? (
                    <div className="rounded-xl border border-border bg-background/40 p-2.5">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                        <Wallet className="size-3" />
                        TO ACCOUNT
                      </div>
                      <AccountSelect
                        value={row.toAccountId}
                        onChange={(id) => patch(row.id, { toAccountId: id })}
                        excludeId={row.accountId ?? undefined}
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-background/40 p-2.5">
                      <div className="mb-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                        CATEGORY
                      </div>
                      <CategorySelect
                        value={row.categoryId}
                        onChange={(id) => patch(row.id, { categoryId: id })}
                        type={row.type}
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div className="rounded-xl border border-border bg-background/40 p-2.5">
                    <div className="mb-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      DESCRIPTION
                    </div>
                    <Input
                      value={row.description}
                      onChange={(e) =>
                        patch(row.id, { description: e.target.value })
                      }
                      placeholder="Optional"
                      className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {/* Tags */}
                  <button
                    onClick={() => setTagSheetFor(row.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-background/40 p-2.5 text-left"
                  >
                    <span className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      <TagIcon className="size-3" />
                      TAGS{row.tagIds.length > 0 ? ` · ${row.tagIds.length}` : ""}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.tagIds.length === 0
                        ? "Add…"
                        : row.tagIds
                            .map((id) => tags?.find((t) => t.id === id)?.name)
                            .filter(Boolean)
                            .join(", ")}
                    </span>
                  </button>

                  {/* Unresolved hints */}
                  {(row.unresolved.category ||
                    row.unresolved.account ||
                    row.unresolved.tags?.length) && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400/80">
                      {row.unresolved.category &&
                        `Category "${row.unresolved.category}" not found — defaulted. `}
                      {row.unresolved.account &&
                        `Account "${row.unresolved.account}" not found. `}
                      {row.unresolved.tags?.length &&
                        `Unknown tags: ${row.unresolved.tags.join(", ")}.`}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="grid h-32 place-items-center text-sm text-muted-foreground">
            No transactions to review.
          </div>
        )}
        {rows.length > 0 && activeRows.length === 0 && (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            Nothing selected — use “Add again” / “Include” to save a row.
          </p>
        )}
      </div>

      {/* Sticky footer */}
      <StickyFooterActions className="flex-col items-stretch gap-2">
        {invalidCount > 0 && (
          <div className="text-center text-[11px] text-destructive">
            {invalidCount} row{invalidCount === 1 ? "" : "s"} need
            {invalidCount === 1 ? "s" : ""} attention
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="h-11 w-full rounded-xl font-semibold"
        >
          <Check className="size-5" />
          {bulkCreate.isPending
            ? "Saving…"
            : `Save all${rows.length > 0 ? ` (${rows.length})` : ""}`}
        </Button>
      </StickyFooterActions>

      {/* Tag picker (shared) */}
      <BottomSheet
        open={tagSheetFor !== null}
        onClose={() => setTagSheetFor(null)}
        title="Choose tags"
        items={tagItems}
        layout="grid"
        searchable={tagItems.length > 6}
        multi
        selectedIds={activeTagRow?.tagIds ?? []}
        onSelectMulti={(ids) =>
          tagSheetFor && patch(tagSheetFor, { tagIds: ids })
        }
        emptyMessage="No tags yet"
      />
    </div>
  );
}
