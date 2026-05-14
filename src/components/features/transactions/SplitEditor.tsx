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

interface SplitEditorProps {
  parent: Transaction;
  onSave: (children: SplitChildFormData[]) => void;
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

  // Allow any debt that matches the parent's currency, regardless of
  // direction. Delta sign is computed at write time based on
  // (transaction type × debt type): same direction increases paid_amount,
  // opposite direction decreases it (i.e. grows remaining debt for lending).
  const compatibleDebts = (debts ?? []).filter((d) => {
    if (!parent.account.currency?.id) return true;
    return d.currencyId === parent.account.currency.id;
  });

  const canSave =
    isBalanced &&
    rows.every(
      (r) =>
        Number(r.amount) > 0 &&
        ((r.mode === "category" && r.category_id) ||
          (r.mode === "debt" && r.debt_id)),
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
      debt_id: r.mode === "debt" ? r.debt_id : null,
    }));
    onSave(children);
  };

  return (
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
                  onChange={(e) =>
                    updateRow(i, { description: e.target.value })
                  }
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
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem
                        value="debt"
                        disabled={compatibleDebts.length === 0}
                      >
                        Debt
                      </SelectItem>
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
                  ) : (
                    <Select
                      value={r.debt_id ?? ""}
                      onValueChange={(v) => updateRow(i, { debt_id: v })}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Pick debt" />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleDebts.map((d) => {
                          const Icon =
                            d.debtType === "i_owe" ? Banknote : HandCoins;
                          const color =
                            d.debtType === "i_owe"
                              ? "text-red-600"
                              : "text-green-600";
                          return (
                            <SelectItem key={d.id} value={d.id}>
                              <div className="flex items-center gap-2 w-full">
                                <Icon
                                  className={cn("size-3.5 shrink-0", color)}
                                />
                                <span className="flex-1 truncate">
                                  {d.name}
                                </span>
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
  );
}
