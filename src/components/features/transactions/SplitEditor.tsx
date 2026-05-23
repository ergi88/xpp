import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Save,
  X,
  Split,
  Banknote,
  HandCoins,
} from "lucide-react";
import { AmountText } from "@/components/shared/AmountText";
import { CategoryPill } from "@/components/shared/CategoryPill";
import { useDebts } from "@/hooks";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import type { SplitChildFormData } from "@/schemas";

export interface PendingDebtForRow {
  name: string;
  debtType: "i_owe" | "owed_to_me";
}

interface SplitEditorProps {
  parent: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    children: SplitChildFormData[],
    pendingDebtsByRow: Record<number, PendingDebtForRow>,
  ) => void;
  onUnsplit?: () => void;
  isSubmitting?: boolean;
}

interface DraftChild {
  id?: string;
  description: string;
  amount: string;
  mode: "category" | "debt";
  category_id: string | null;
  debt_id: string | null;
  pendingDebtName: string | null;
}

function emptyRow(): DraftChild {
  return {
    description: "",
    amount: "",
    mode: "category",
    category_id: null,
    debt_id: null,
    pendingDebtName: null,
  };
}

function fromExisting(c: Transaction): DraftChild {
  return {
    id: c.id,
    description: c.description ?? "",
    amount: String(c.amount),
    mode: c.debtId ? "debt" : "category",
    category_id: c.category?.id ?? null,
    debt_id: c.debtId,
    pendingDebtName: null,
  };
}

export function SplitEditor({
  parent,
  open,
  onOpenChange,
  onSave,
  onUnsplit,
  isSubmitting,
}: SplitEditorProps) {
  const { data: debts } = useDebts();
  const [rows, setRows] = useState<DraftChild[]>(() =>
    parent.children && parent.children.length > 0
      ? parent.children.map(fromExisting)
      : [emptyRow(), emptyRow()],
  );

  const [newDebtDialogRow, setNewDebtDialogRow] = useState<number | null>(null);
  const [newDebtName, setNewDebtName] = useState("");

  const decimals = parent.account.currency?.decimals ?? 2;
  const symbol = parent.account.currency?.symbol ?? "";

  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = parent.amount - sum;
  const isBalanced = Math.abs(diff) < 0.01;

  const updateRow = (idx: number, patch: Partial<DraftChild>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const compatibleDebts = (debts ?? []).filter((d) => {
    if (!parent.account.currency?.id) return true;
    return d.currencyId === parent.account.currency.id;
  });

  const inferredDebtType: PendingDebtForRow["debtType"] =
    parent.type === "income" ? "i_owe" : "owed_to_me";

  const canSave =
    isBalanced &&
    rows.every(
      (r) =>
        Number(r.amount) > 0 &&
        ((r.mode === "category" && r.category_id) ||
          (r.mode === "debt" && (r.debt_id || r.pendingDebtName))),
    );

  const handleSave = () => {
    if (!canSave) return;
    const children: SplitChildFormData[] = rows.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      description: r.description || undefined,
      amount: Number(r.amount),
      category_id: r.mode === "category" ? r.category_id : null,
      debt_id: r.mode === "debt" && !r.pendingDebtName ? r.debt_id : null,
    }));

    const pendingDebtsByRow: Record<number, PendingDebtForRow> = {};
    rows.forEach((r, i) => {
      if (r.mode === "debt" && r.pendingDebtName) {
        pendingDebtsByRow[i] = { name: r.pendingDebtName, debtType: inferredDebtType };
      }
    });

    onSave(children, pendingDebtsByRow);
  };

  const handleConfirmNewDebt = () => {
    if (newDebtDialogRow === null || !newDebtName.trim()) return;
    updateRow(newDebtDialogRow, { pendingDebtName: newDebtName.trim(), debt_id: null });
    setNewDebtName("");
    setNewDebtDialogRow(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-3xl max-h-[90dvh] overflow-hidden [&>button]:z-10">
          <DialogTitle className="sr-only">Split Transaction</DialogTitle>

          {/* ── Sticky header ── */}
          <div className="shrink-0 px-6 py-5 border-b bg-background">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="min-w-0">
                <p className="text-base font-semibold truncate">
                  {parent.description || "Transaction"}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    {new Date(parent.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {parent.category && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <CategoryPill
                        name={parent.category.name}
                        icon={parent.category.icon}
                        color={parent.category.color}
                        size="sm"
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                  Amount
                </p>
                <p className="text-2xl font-bold font-mono tracking-tight">
                  <AmountText
                    value={parent.amount}
                    decimals={decimals}
                    currency={symbol}
                  />
                </p>
              </div>
            </div>
          </div>

          {/* ── Column headers (desktop) ── */}
          <div className="hidden sm:grid grid-cols-[1fr_9rem_1fr_2.5rem] gap-2 px-6 py-2.5 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</span>
            <span />
          </div>

          {/* ── Scrollable rows ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-border">
              {rows.map((r, i) => (
                <div key={i} className="px-6 py-4">
                  {/* Mobile: stacked · Desktop: grid columns */}
                  <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_9rem_1fr_2.5rem] sm:gap-2 sm:items-start">

                    {/* Description */}
                    <div className="space-y-1.5 sm:space-y-0">
                      <Label className="sm:hidden text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={r.description}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                        placeholder="Part label (optional)"
                        className="h-9"
                      />
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5 sm:space-y-0">
                      <div className="sm:hidden flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Amount</Label>
                        {Number(r.amount) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {((Number(r.amount) / parent.amount) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        {symbol && (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                            {symbol}
                          </span>
                        )}
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={r.amount}
                          onChange={(e) => updateRow(i, { amount: e.target.value })}
                          className={cn("h-9 font-mono", symbol && "pl-8")}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Attribution */}
                    <div className="space-y-1.5 sm:space-y-0">
                      <Label className="sm:hidden text-xs text-muted-foreground">Category</Label>
                      <div className="flex gap-1.5">
                        <Select
                          value={r.mode}
                          onValueChange={(v) =>
                            updateRow(i, {
                              mode: v as "category" | "debt",
                              category_id: null,
                              debt_id: null,
                              pendingDebtName: null,
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-24 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="category">Category</SelectItem>
                            <SelectItem value="debt">Debt</SelectItem>
                          </SelectContent>
                        </Select>

                        {r.mode === "category" ? (
                          <div className="flex-1 min-w-0">
                            <CategorySelect
                              value={r.category_id}
                              onChange={(v) => updateRow(i, { category_id: v })}
                              type={
                                parent.type === "transfer"
                                  ? "expense"
                                  : (parent.type as "income" | "expense")
                              }
                              withFormControl={false}
                            />
                          </div>
                        ) : r.pendingDebtName ? (
                          <div className="flex-1 flex items-center gap-1.5 px-3 h-9 rounded-md border bg-muted/50 min-w-0">
                            <Banknote className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate text-sm font-medium">
                              New: {r.pendingDebtName}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateRow(i, { pendingDebtName: null })}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Select
                            value={r.debt_id ?? ""}
                            onValueChange={(v) => {
                              if (v === "__new__") { setNewDebtDialogRow(i); return; }
                              updateRow(i, { debt_id: v || null });
                            }}
                          >
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue placeholder="Select debt" />
                            </SelectTrigger>
                            <SelectContent>
                              {compatibleDebts.map((d) => {
                                const DebtIcon = d.debtType === "i_owe" ? Banknote : HandCoins;
                                const color = d.debtType === "i_owe" ? "text-red-600" : "text-green-600";
                                return (
                                  <SelectItem key={d.id} value={d.id}>
                                    <div className="flex items-center gap-2 w-full">
                                      <DebtIcon className={cn("size-3.5 shrink-0", color)} />
                                      <span className="flex-1 truncate">{d.name}</span>
                                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                        <AmountText
                                          value={d.remainingDebt}
                                          decimals={d.currency?.decimals ?? 2}
                                          currency={d.currency?.symbol}
                                        />
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                              <SelectItem value="__new__">
                                <span className="text-primary font-medium">+ Create new debt</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <div className="flex sm:justify-center sm:pt-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add row */}
            <div className="px-6 py-3">
              <button
                type="button"
                onClick={addRow}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors border border-dashed border-border hover:border-foreground/30"
              >
                <Plus className="size-4" />
                Add split
              </button>
            </div>
          </div>

          {/* ── Sticky footer ── */}
          <div className="shrink-0 border-t bg-background px-6 pt-4 pb-5 space-y-3">

            {/* Remaining indicator */}
            <div
              className={cn(
                "rounded-lg px-4 py-3 flex items-center justify-between",
                isBalanced
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-destructive/10 border border-destructive/20",
              )}
            >
              <div>
                <p className={cn("text-sm font-semibold", isBalanced ? "text-green-600" : "text-destructive")}>
                  {isBalanced ? "Balanced" : "Remaining"}
                </p>
                {!isBalanced && (
                  <p className="text-xs text-destructive mt-0.5">
                    Split amounts must equal the original transaction amount.
                  </p>
                )}
              </div>
              <span className={cn("font-mono font-bold text-lg tabular-nums", isBalanced ? "text-green-600" : "text-destructive")}>
                {isBalanced
                  ? "✓"
                  : `${diff > 0 ? "" : "+"}${Math.abs(diff).toFixed(decimals)}`}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {onUnsplit && parent.children && parent.children.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={onUnsplit}
                  disabled={isSubmitting}
                >
                  <Split className="size-4 mr-1.5" />
                  Unsplit
                </Button>
              )}
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canSave || isSubmitting}
              >
                <Save className="size-4 mr-1.5" />
                {isSubmitting ? "Saving…" : "Split Transaction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New debt dialog */}
      <Dialog
        open={newDebtDialogRow !== null}
        onOpenChange={(open) => {
          if (!open) { setNewDebtDialogRow(null); setNewDebtName(""); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new debt for this part</DialogTitle>
            <DialogDescription>
              {parent.type === "income"
                ? "Income row → 'I owe' debt. This split will be the origin transaction."
                : "Expense row → 'Owed to me' debt. This split will be the origin transaction."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="split-debt-name">Debt name</Label>
            <Input
              id="split-debt-name"
              value={newDebtName}
              onChange={(e) => setNewDebtName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmNewDebt()}
              placeholder="e.g. Lunch with John"
              autoFocus
            />
            <p className="text-xs text-muted-foreground pt-1">
              Amount and currency will be taken from this split part.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setNewDebtDialogRow(null); setNewDebtName(""); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newDebtName.trim()}
              onClick={handleConfirmNewDebt}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
