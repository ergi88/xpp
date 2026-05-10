import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useAccount,
  useTransactions,
  useCurrencies,
  useCreateTransaction,
  useCategories,
} from "@/hooks";
import { AccountCard } from "@/components/features/accounts/AccountCard";
import { AccountStats } from "@/components/features/accounts/AccountStats";
import { AmountText } from "@/components/shared/AmountText";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { ACCOUNT_TYPE_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";

export default function AccountViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: account, isLoading } = useAccount(id!);
  const { data: currencies } = useCurrencies();
  const { data: txnsData } = useTransactions({ account_id: id, per_page: 10 });
  const { data: categories } = useCategories();
  const createTransaction = useCreateTransaction();
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileBalance, setReconcileBalance] = useState("");
  const [reconcileDate, setReconcileDate] = useState("");
  const [reconcileDescription, setReconcileDescription] = useState("Reconcile");
  const [reconcileCategoryId, setReconcileCategoryId] = useState("");

  const enrichedAccount =
    account && currencies
      ? {
          ...account,
          currency: currencies.find(
            (c) => c.id.toString() === account.currencyId,
          ),
        }
      : account;

  const currentBalance = enrichedAccount?.currentBalance ?? 0;
  const currencySymbol = enrichedAccount?.currency?.symbol;
  const currencyDecimals = enrichedAccount?.currency?.decimals ?? 2;

  const parsedReconcileBalance = useMemo(() => {
    if (!reconcileBalance.trim()) return null;
    const parsed = Number(reconcileBalance);
    return Number.isFinite(parsed) ? parsed : null;
  }, [reconcileBalance]);

  const balanceStep = useMemo(() => {
    if (currencyDecimals <= 0) return 1;
    const zeros = "0".repeat(currencyDecimals - 1);
    return Number(`0.${zeros}1`);
  }, [currencyDecimals]);

  const reconcileDelta = useMemo(() => {
    if (parsedReconcileBalance == null) return null;
    return parsedReconcileBalance - currentBalance;
  }, [parsedReconcileBalance, currentBalance]);

  const reconcileType = useMemo(() => {
    if (reconcileDelta == null || reconcileDelta === 0) return null;
    return reconcileDelta > 0 ? "income" : "expense";
  }, [reconcileDelta]);

  const canReconcile =
    reconcileType !== null &&
    reconcileDelta != null &&
    reconcileCategoryId.length > 0 &&
    reconcileDate.trim().length > 0;

  useEffect(() => {
    if (!reconcileOpen || !enrichedAccount) return;
    const today = new Date().toISOString().split("T")[0];
    setReconcileBalance(String(currentBalance));
    setReconcileDate(today);
    setReconcileDescription("Reconcile");
    setReconcileCategoryId("");
  }, [reconcileOpen, currentBalance, enrichedAccount?.id]);

  useEffect(() => {
    if (!reconcileOpen || !reconcileType || !categories?.length) return;
    const valid = categories.filter((c) => c.type === reconcileType);
    if (!valid.length) {
      setReconcileCategoryId("");
      return;
    }
    if (!valid.some((c) => c.id === reconcileCategoryId)) {
      setReconcileCategoryId(valid[0].id);
    }
  }, [reconcileOpen, reconcileType, categories, reconcileCategoryId]);

  const handleReconcile = () => {
    if (!enrichedAccount || !reconcileType || reconcileDelta == null) return;
    createTransaction.mutate(
      {
        type: reconcileType,
        account_id: enrichedAccount.id,
        category_id: reconcileCategoryId,
        amount: Math.abs(reconcileDelta),
        description: reconcileDescription?.trim() || "Reconcile",
        date: reconcileDate,
        tag_ids: [],
      },
      {
        onSuccess: () => setReconcileOpen(false),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!enrichedAccount) {
    return <div className="p-6 text-muted-foreground">Account not found.</div>;
  }

  const config = ACCOUNT_TYPE_CONFIG[enrichedAccount.type];
  const Icon = config.icon;
  const transactions = txnsData?.data ?? [];

  return (
    <div className="md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/accounts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className={cn("p-2 rounded-lg", config.color)}>
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{enrichedAccount.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className={config.color}>
                {config.label}
              </Badge>
              {enrichedAccount.currency && (
                <span className="text-sm text-muted-foreground font-mono">
                  {enrichedAccount.currency.code}
                </span>
              )}
              {!enrichedAccount.isActive && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <RefreshCw className="mr-2 size-4" />
                Reconcile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Reconcile balance</DialogTitle>
                <DialogDescription>
                  Enter the real balance to create a reconciliation transaction.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="reconcile-balance">New balance</Label>
                  <Input
                    id="reconcile-balance"
                    type="number"
                    step={balanceStep}
                    placeholder="0.00"
                    value={reconcileBalance}
                    onChange={(e) => setReconcileBalance(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="reconcile-date">Date</Label>
                    <Input
                      id="reconcile-date"
                      type="date"
                      value={reconcileDate}
                      onChange={(e) => setReconcileDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <CategorySelect
                      type={
                        (reconcileType ?? "expense") as "income" | "expense"
                      }
                      value={reconcileCategoryId}
                      onChange={setReconcileCategoryId}
                      disabled={!reconcileType}
                      withFormControl={false}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reconcile-notes">Description</Label>
                  <Textarea
                    id="reconcile-notes"
                    className="resize-none h-20"
                    value={reconcileDescription}
                    onChange={(e) => setReconcileDescription(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current</span>
                    <AmountText
                      value={enrichedAccount.currentBalance}
                      decimals={currencyDecimals}
                      currency={currencySymbol}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">New</span>
                    <AmountText
                      value={
                        parsedReconcileBalance ?? enrichedAccount.currentBalance
                      }
                      decimals={currencyDecimals}
                      currency={currencySymbol}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Difference</span>
                    <AmountText
                      value={reconcileDelta ?? 0}
                      decimals={currencyDecimals}
                      currency={currencySymbol}
                      signDisplay="always"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {reconcileType
                      ? `Creates an ${reconcileType} reconciliation transaction.`
                      : "Enter a new balance to calculate the adjustment."}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleReconcile}
                  disabled={!canReconcile || createTransaction.isPending}
                >
                  {createTransaction.isPending
                    ? "Creating..."
                    : reconcileType
                      ? `Create ${reconcileType} reconcile`
                      : "Create reconcile"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button asChild>
            <Link to={`/accounts/${id}/edit`}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Card visual — only renders if cardLastDigits or cardExpiry are set */}
      <AccountCard account={enrichedAccount} />

      {/* Balance / credit stats */}
      <AccountStats account={enrichedAccount} />

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/transactions?account_id=${id}`}>View all</Link>
          </Button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">
                    {t.description ?? "No description"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
                <p
                  className={cn(
                    "font-mono font-medium",
                    t.type === "income" ? "text-green-600" : "text-red-600",
                  )}
                >
                  <AmountText
                    value={t.type === "income" ? t.amount : -t.amount}
                    decimals={enrichedAccount.currency?.decimals ?? 2}
                    currency={enrichedAccount.currency?.symbol}
                    signDisplay="always"
                  />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring / Maintenance Fee */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Maintenance Fee</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/recurring/create">
              <Plus className="mr-1 size-4" />
              Set up
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a recurring expense to track monthly maintenance or
          subscription fees for this account.
        </p>
      </div>
    </div>
  );
}
