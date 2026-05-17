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
  DialogHeader,
  DialogTitle,
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
  onSave: (
    children: SplitChildFormData[],
    pendingDebtsByRow: Record<number, PendingDebtForRow>,
  ) => void;
  onCancel: () => void;
  onUnsplit?: () => void;
  isSubmitting?: boolean;
}

interface DraftChild {
  id?: string;
  description: string;
  quantity: string;
  price_per_unit: string;
  amount: string;
  mode: "category" | "debt";
  category_id: string | null;
  debt_id: string | null;
  // Set when user picks "Create new debt" for this row
  pendingDebtName: string | null;
}

function emptyRow(): DraftChild {
  return {
    description: "",
    quantity: "",
    price_per_unit: "",
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
    quantity: "",
    price_per_unit: "",
    amount: String(c.amount),
    mode: c.debtId ? "debt" : "category",
    category_id: c.category?.id ?? null,
    debt_id: c.debtId,
    pendingDebtName: null,
  };
}

export function SplitEditor({
  parent,
  onSave,
  onCancel,
  onUnsplit,
  isSubmitting,
}: SplitEditorProps) {
  const { data: debts } = useDebts();
  const [rows, setRows] = useState<DraftChild[]>(() =>
    parent.children && parent.children.length > 0
      ? parent.children.map(fromExisting)
      : [emptyRow(), emptyRow()],
  );

  // Dialog state for creating a new debt on a specific row
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

  // Debt type inferred from parent transaction type
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
      quantity: r.quantity ? Number(r.quantity) : undefined,
      price_per_unit: r.price_per_unit ? Number(r.price_per_unit) : undefined,
      amount: Number(r.amount),
      category_id: r.mode === "category" ? r.category_id : null,
      // Pending rows have no debt yet — debt_id will be set after creation
      debt_id: r.mode === "debt" && !r.pendingDebtName ? r.debt_id : null,
    }));

    const pendingDebtsByRow: Record<number, PendingDebtForRow> = {};
    rows.forEach((r, i) => {
      if (r.mode === "debt" && r.pendingDebtName) {
        pendingDebtsByRow[i] = {
          name: r.pendingDebtName,
          debtType: inferredDebtType,
        };
      }
    });

    onSave(children, pendingDebtsByRow);
  };

  const handleConfirmNewDebt = () => {
    if (newDebtDialogRow === null || !newDebtName.trim()) return;
    updateRow(newDebtDialogRow, {
      pendingDebtName: newDebtName.trim(),
      debt_id: null,
    });
    setNewDebtName("");
    setNewDebtDialogRow(null);
  };

  return (
    <>
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Description</th>
              <th className="text-left p-2 font-medium w-16">Qty</th>
              <th className="text-left p-2 font-medium w-24">Price</th>
              <th className="text-left p-2 font-medium w-28">Amount</th>
              <th className="text-left p-2 font-medium w-48">Attribute to</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-1">
                  <Input
                    value={r.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
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
                    onChange={(e) => {
                      const q = e.target.value;
                      const p = Number(r.price_per_unit);
                      const next: Partial<DraftChild> = { quantity: q };
                      if (Number(q) > 0 && p >= 0)
                        next.amount = (Number(q) * p).toFixed(decimals);
                      updateRow(i, next);
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
                    onChange={(e) => {
                      const p = e.target.value;
                      const q = Number(r.quantity);
                      const next: Partial<DraftChild> = { price_per_unit: p };
                      if (Number(p) >= 0 && q > 0)
                        next.amount = (Number(p) * q).toFixed(decimals);
                      updateRow(i, next);
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
                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                    className="h-8 border-0 shadow-none focus-visible:ring-1 font-mono"
                  />
                </td>
                <td className="p-1">
                  <div className="flex gap-1">
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
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="debt">Debt</SelectItem>
                      </SelectContent>
                    </Select>

                    {r.mode === "category" ? (
                      <div className="flex-1">
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
                      /* Pending new debt indicator */
                      <div className="flex-1 flex items-center gap-1 px-2 h-8 rounded-md border bg-muted/50 text-xs">
                        <span className="flex-1 truncate font-medium">
                          New: {r.pendingDebtName}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateRow(i, { pendingDebtName: null })}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <Select
                        value={r.debt_id ?? ""}
                        onValueChange={(v) => {
                          if (v === "__new__") {
                            setNewDebtDialogRow(i);
                            return;
                          }
                          updateRow(i, { debt_id: v || null });
                        }}
                      >
                        <SelectTrigger className="h-8 flex-1">
                          <SelectValue placeholder="Pick debt" />
                        </SelectTrigger>
                        <SelectContent>
                          {compatibleDebts.map((d) => {
                            const Icon = d.debtType === "i_owe" ? Banknote : HandCoins;
                            const color =
                              d.debtType === "i_owe" ? "text-red-600" : "text-green-600";
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                <div className="flex items-center gap-2 w-full">
                                  <Icon className={cn("size-3.5 shrink-0", color)} />
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
                            <span className="text-primary font-medium">
                              + Create new debt
                            </span>
                          </SelectItem>
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
              <td
                className={cn(
                  "p-2 text-right font-mono font-semibold",
                  !isBalanced && "text-destructive",
                )}
              >
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
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onUnsplit}
            >
              <Split className="size-4 mr-1" />
              Unsplit
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!canSave || isSubmitting}
          >
            <Save className="size-4 mr-1" />
            Save split
          </Button>
        </div>
      </div>

      {/* New debt dialog for split rows */}
      <Dialog
        open={newDebtDialogRow !== null}
        onOpenChange={(open) => {
          if (!open) { setNewDebtDialogRow(null); setNewDebtName(""); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new debt for this row</DialogTitle>
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
              Amount and currency will be taken from this split row.
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
