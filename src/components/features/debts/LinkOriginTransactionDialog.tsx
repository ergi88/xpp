import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AmountText } from "@/components/shared/AmountText";
import { ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { useTransactions } from "@/hooks";
import type { Debt, Transaction } from "@/types";
import { cn } from "@/lib/utils";

interface LinkOriginTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: Debt;
  onLink: (transactionId: string) => void;
  isLinking?: boolean;
}

export function LinkOriginTransactionDialog({
  open,
  onOpenChange,
  debt,
  onLink,
  isLinking,
}: LinkOriginTransactionDialogProps) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useTransactions({ per_page: 99999 });

  const transactions = useMemo(() => {
    const all: Transaction[] = data?.data ?? [];
    const lower = search.toLowerCase();
    return all
      .filter((t) => {
        if (t.debtId) return false;
        if (search) {
          return (
            t.description?.toLowerCase().includes(lower) ||
            t.account?.name?.toLowerCase().includes(lower) ||
            String(t.amount).includes(lower)
          );
        }
        return Math.abs(t.amount - debt.targetAmount) < 0.01;
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  }, [data, search, debt.targetAmount]);

  const handleSelect = (txn: Transaction) => {
    onLink(txn.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Origin Transaction</DialogTitle>
          <DialogDescription>
            Select a transaction that originated this debt
            {" "}({debt.currency?.symbol}{debt.targetAmount.toFixed(debt.currency?.decimals ?? 2)}).
            Showing exact matches by default — search to find others.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, account, or amount..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {search ? "No transactions match your search." : "No transactions found matching this debt amount."}
            </p>
          ) : (
            transactions.map((txn) => {
              const isIncome = txn.type === "income";
              const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
              const color = isIncome ? "text-green-600" : "text-red-600";
              return (
                <button
                  key={txn.id}
                  disabled={isLinking}
                  onClick={() => handleSelect(txn)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border p-3",
                    "hover:bg-muted/50 transition-colors text-left",
                    isLinking && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full p-1.5 bg-muted">
                      <Icon className={cn("size-4", color)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{txn.description || txn.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {txn.date} · {txn.account?.name}
                      </p>
                    </div>
                  </div>
                  <span className={cn("font-mono text-sm font-semibold", color)}>
                    <AmountText
                      value={txn.amount}
                      decimals={txn.account?.currency?.decimals ?? 2}
                      currency={txn.account?.currency?.symbol}
                    />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
