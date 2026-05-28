import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  CreditCard,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Page } from "@/components/shared";
import { AmountText } from "@/components/shared/AmountText";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useDebt,
  useDebtTransactions,
  useDeleteDebt,
  useDebtPayment,
  useDebtCollection,
  useReopenDebt,
  useLinkOriginTransaction,
} from "@/hooks";
import {
  DebtPaymentDialog,
  LinkOriginTransactionDialog,
} from "@/components/features/debts";
import { useState } from "react";
import { DebtPaymentFormData } from "@/schemas";
import type { Transaction } from "@/types";
import { formatDisplayDate } from "@/lib/date";

function TransactionRow({ txn, label }: { txn: Transaction; label: string }) {
  const isIncome = txn.type === "income";
  const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
  const color = isIncome ? "text-green-600" : "text-red-600";

  return (
    <Link
      to={`/transactions/${txn.id}`}
      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-1.5 bg-muted`}>
          <Icon className={`size-4 ${color}`} />
        </div>
        <div>
          <p className="text-sm font-medium">{txn.description || txn.type}</p>
          <p className="text-xs text-muted-foreground">
            {formatDisplayDate(txn.date)} · {txn.account?.name}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {label}
        </Badge>
        <span className={`font-mono text-sm font-semibold ${color}`}>
          <AmountText
            value={txn.amount}
            decimals={txn.account?.currency?.decimals ?? 2}
            currency={txn.account?.currency?.symbol}
          />
        </span>
      </div>
    </Link>
  );
}

export default function DebtViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: debt, isLoading: debtLoading } = useDebt(id!);
  const { data: txnData, isLoading: txnLoading } = useDebtTransactions(id!);
  console.log("🚀 ~ DebtViewPage ~ txnData:", { txnData, debt });
  const deleteDebt = useDeleteDebt();
  const debtPayment = useDebtPayment();
  const debtCollection = useDebtCollection();
  const reopenDebt = useReopenDebt();

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"payment" | "collection">(
    "payment",
  );
  const [linkOriginOpen, setLinkOriginOpen] = useState(false);
  const linkOriginTransaction = useLinkOriginTransaction();

  if (debtLoading) {
    return (
      <Page title="Debt">
        <div className="p-8">Loading...</div>
      </Page>
    );
  }

  if (!debt) {
    return (
      <Page title="Debt">
        <div className="p-8 text-muted-foreground">Debt not found.</div>
      </Page>
    );
  }

  const isIOwe = debt.debtType === "i_owe";
  const DebtIcon = isIOwe ? TrendingDown : TrendingUp;
  const debtColor = isIOwe ? "text-red-600" : "text-green-600";
  const debtBg = isIOwe ? "bg-red-100" : "bg-green-100";

  const handleDelete = () => {
    deleteDebt.mutate(debt.id, {
      onSuccess: () => navigate("/debts"),
    });
  };

  const handlePaymentSubmit = (debtId: string, data: DebtPaymentFormData) => {
    if (paymentMode === "payment") {
      debtPayment.mutate(
        { debtId, data },
        { onSuccess: () => setPaymentDialogOpen(false) },
      );
    } else {
      debtCollection.mutate(
        { debtId, data },
        { onSuccess: () => setPaymentDialogOpen(false) },
      );
    }
  };

  const allTransactions = [
    ...(txnData?.payments ?? []).map((t) => ({
      txn: t,
      label: isIOwe ? "Payment" : "Collection",
    })),
  ].sort((a, b) => b.txn.date.localeCompare(a.txn.date));

  return (
    <Page title={debt.name}>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/debts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{debt.name}</h1>
            {debt.counterparty && (
              <p className="text-muted-foreground">{debt.counterparty}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/debts/${debt.id}/edit`}>
                <Pencil className="size-4 mr-1" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="size-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete debt?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{debt.name}". This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Summary card */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${debtBg}`}>
              <DebtIcon className={`size-5 ${debtColor}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isIOwe ? "I owe" : "Owed to me"}
              </p>
              <p className={`text-3xl font-bold ${debtColor}`}>
                <AmountText
                  value={debt.remainingDebt}
                  decimals={debt.currency?.decimals ?? 2}
                  currency={debt.currency?.symbol}
                />
              </p>
            </div>
            {debt.isPaidOff ? (
              <Badge className="ml-auto" variant="outline">
                Paid off
              </Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-semibold">
                <AmountText
                  value={debt.targetAmount}
                  decimals={debt.currency?.decimals ?? 2}
                  currency={debt.currency?.symbol}
                />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {isIOwe ? "Paid" : "Collected"}
              </p>
              <p className="font-semibold">
                <AmountText
                  value={debt.paidAmount}
                  decimals={debt.currency?.decimals ?? 2}
                  currency={debt.currency?.symbol}
                />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Progress</p>
              <p className="font-semibold">
                {debt.paymentProgress.toFixed(0)}%
              </p>
            </div>
          </div>

          {debt.targetAmount > 0 && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isIOwe ? "bg-red-500" : "bg-green-500"}`}
                style={{
                  width: `${Math.min(100, debt.paymentProgress)}%`,
                }}
              />
            </div>
          )}

          {debt.dueDate && (
            <p className="text-sm text-muted-foreground">
              Due: {formatDisplayDate(debt.dueDate)}
            </p>
          )}

          {debt.description && (
            <p className="text-sm text-muted-foreground">{debt.description}</p>
          )}

          {!debt.isPaidOff && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  setPaymentMode(isIOwe ? "payment" : "collection");
                  setPaymentDialogOpen(true);
                }}
              >
                {isIOwe ? "Make Payment" : "Collect Payment"}
              </Button>
              {debt.isPaidOff === false && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reopenDebt.mutate(debt.id)}
                >
                  Reopen
                </Button>
              )}
            </div>
          )}
          {debt.isPaidOff && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => reopenDebt.mutate(debt.id)}
            >
              Reopen
            </Button>
          )}
        </div>

        {/* Origin transaction */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Origin Transaction
            </h2>
          </div>
          {txnLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : txnData?.origin ? (
            <TransactionRow
              txn={txnData.origin}
              label={isIOwe ? "Received" : "Paid"}
            />
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground italic flex-1">
                No origin transaction — debt was created without a linked
                transaction.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLinkOriginOpen(true)}
              >
                <Link2 className="size-3.5 mr-1.5" />
                Link Transaction
              </Button>
            </div>
          )}
        </div>

        {/* Payment history */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {isIOwe ? "Payments" : "Collections"}
            </h2>
          </div>
          {txnLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : allTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No payments recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {allTransactions.map(({ txn, label }) => (
                <TransactionRow key={txn.id} txn={txn} label={label} />
              ))}
            </div>
          )}
        </div>
      </div>

      <DebtPaymentDialog
        debt={debt}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSubmit={handlePaymentSubmit}
        isSubmitting={debtPayment.isPending || debtCollection.isPending}
        mode={paymentMode}
      />

      {!txnData?.origin && (
        <LinkOriginTransactionDialog
          open={linkOriginOpen}
          onOpenChange={setLinkOriginOpen}
          debt={debt}
          onLink={(txnId) => {
            linkOriginTransaction.mutate(
              { id: debt.id, transactionId: txnId },
              { onSuccess: () => setLinkOriginOpen(false) },
            );
          }}
          isLinking={linkOriginTransaction.isPending}
        />
      )}
    </Page>
  );
}
