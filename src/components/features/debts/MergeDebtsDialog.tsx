import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AmountText } from "@/components/shared/AmountText";
import { Banknote, HandCoins } from "lucide-react";
import type { Debt } from "@/types";
import { cn } from "@/lib/utils";

interface MergeDebtsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debts: Debt[];
  onMerge: (debtIds: string[]) => void;
  isMerging?: boolean;
}

export function MergeDebtsDialog({
  open,
  onOpenChange,
  debts,
  onMerge,
  isMerging,
}: MergeDebtsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDebts = debts.filter((d) => selected.has(d.id));

  // Validate: all selected must have same debtType and currency
  const types = new Set(selectedDebts.map((d) => d.debtType));
  const currencies = new Set(selectedDebts.map((d) => d.currencyId));
  const isValid = selected.size >= 2 && types.size === 1 && currencies.size === 1;

  const validationMessage =
    selected.size >= 2 && types.size > 1
      ? "All selected debts must be the same type (I Owe or Owed to Me)"
      : selected.size >= 2 && currencies.size > 1
        ? "All selected debts must use the same currency"
        : null;

  const sortedDebts = [...debts].sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );

  const primaryId = selectedDebts.length >= 2
    ? [...selectedDebts].sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
      )[0].id
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected(new Set()); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge Debts</DialogTitle>
          <DialogDescription>
            Select 2 or more debts to merge. The oldest debt becomes the primary —
            its origin transaction is preserved and all payments are consolidated under it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {sortedDebts.map((debt) => {
            const isIOwe = debt.debtType === "i_owe";
            const Icon = isIOwe ? Banknote : HandCoins;
            const isPrimary = debt.id === primaryId;
            return (
              <button
                key={debt.id}
                onClick={() => toggle(debt.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected.has(debt.id)
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <Checkbox
                  checked={selected.has(debt.id)}
                  onCheckedChange={() => toggle(debt.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className={cn("p-1.5 rounded-lg", isIOwe ? "bg-red-100" : "bg-green-100")}>
                  <Icon className={cn("size-4", isIOwe ? "text-red-600" : "text-green-600")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{debt.name}</p>
                    {isPrimary && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">Primary</Badge>
                    )}
                  </div>
                  {debt.counterparty && (
                    <p className="text-xs text-muted-foreground truncate">{debt.counterparty}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-semibold font-mono", isIOwe ? "text-red-600" : "text-green-600")}>
                    <AmountText
                      value={debt.remainingDebt}
                      decimals={debt.currency?.decimals ?? 2}
                      currency={debt.currency?.symbol}
                    />
                  </p>
                  <p className="text-[10px] text-muted-foreground">remaining</p>
                </div>
              </button>
            );
          })}
        </div>

        {validationMessage && (
          <p className="text-sm text-destructive">{validationMessage}</p>
        )}

        {isValid && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-medium">Merge summary</p>
            <p className="text-muted-foreground">
              Total:{" "}
              <span className="font-semibold text-foreground">
                <AmountText
                  value={selectedDebts.reduce((s, d) => s + d.targetAmount, 0)}
                  decimals={selectedDebts[0]?.currency?.decimals ?? 2}
                  currency={selectedDebts[0]?.currency?.symbol}
                />
              </span>
              {" "}· Remaining:{" "}
              <span className="font-semibold text-foreground">
                <AmountText
                  value={selectedDebts.reduce((s, d) => s + d.remainingDebt, 0)}
                  decimals={selectedDebts[0]?.currency?.decimals ?? 2}
                  currency={selectedDebts[0]?.currency?.symbol}
                />
              </span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelected(new Set()); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button disabled={!isValid || isMerging} onClick={() => onMerge([...selected])}>
            {isMerging ? "Merging..." : `Merge ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
