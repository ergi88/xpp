import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DataTable, Page } from "@/components/shared";
import {
  createDebtColumns,
  DebtPaymentDialog,
  MergeDebtsDialog,
} from "@/components/features/debts";
import {
  useDebtsWithSummary,
  useDeleteDebt,
  useDebtPayment,
  useDebtCollection,
  useReopenDebt,
  useMergeDebts,
} from "@/hooks";
import { Debt } from "@/types";
import { DebtPaymentFormData } from "@/schemas";
import { DebtWidgets } from "./DebtWidgets";

export default function DebtsPage() {
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentMode, setPaymentMode] = useState<"payment" | "collection">(
    "payment",
  );
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const { data, isLoading } = useDebtsWithSummary({
    include_completed: includeCompleted,
  });
  const deleteDebt = useDeleteDebt();
  const debtPayment = useDebtPayment();
  const debtCollection = useDebtCollection();
  const reopenDebt = useReopenDebt();
  const mergeDebts = useMergeDebts();

  const debts = data?.data ?? [];
  const isReadOnly = false;

  const debtsWithOrigin = debts.filter((d) => !!d.originTransactionId);
  const debtsWithoutOrigin = debts.filter((d) => !d.originTransactionId);

  const handlePayment = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentMode("payment");
    setPaymentDialogOpen(true);
  };

  const handleCollect = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentMode("collection");
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = (
    debtId: string,
    formData: DebtPaymentFormData,
  ) => {
    if (paymentMode === "payment") {
      debtPayment.mutate(
        { debtId, data: formData },
        { onSuccess: () => setPaymentDialogOpen(false) },
      );
    } else {
      debtCollection.mutate(
        { debtId, data: formData },
        { onSuccess: () => setPaymentDialogOpen(false) },
      );
    }
  };

  const columns = createDebtColumns({
    onDelete: (id) => deleteDebt.mutate(id),
    onPayment: handlePayment,
    onCollect: handleCollect,
    onReopen: (id) => reopenDebt.mutate(id),
    isReadOnly,
  });

  return (
    <Page title="Debts">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button asChild>
            <Link to="/debts/create">
              <Plus className="mr-2 size-4" />
              New Debt
            </Link>
          </Button>
          {debts.length >= 2 && (
            <Button
              variant="outline"
              onClick={() => setMergeDialogOpen(true)}
            >
              <Merge className="mr-2 size-4" />
              Merge Debts
            </Button>
          )}
        </div>

        <DebtWidgets />

        <div className="flex items-center space-x-2">
          <Switch
            id="include-completed"
            checked={includeCompleted}
            onCheckedChange={setIncludeCompleted}
          />
          <Label htmlFor="include-completed">Show completed debts</Label>
        </div>

        {/* Debts with origin transaction */}
        {debtsWithOrigin.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Linked to Transaction
            </h2>
            <DataTable
              columns={columns}
              data={debtsWithOrigin}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Debts without origin transaction */}
        {debtsWithoutOrigin.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              No Linked Transaction
            </h2>
            <DataTable
              columns={columns}
              data={debtsWithoutOrigin}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Fallback when no data loaded yet */}
        {isLoading && debts.length === 0 && (
          <DataTable columns={columns} data={[]} isLoading={isLoading} />
        )}

        <DebtPaymentDialog
          debt={selectedDebt}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          onSubmit={handlePaymentSubmit}
          isSubmitting={debtPayment.isPending || debtCollection.isPending}
          mode={paymentMode}
        />

        <MergeDebtsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          debts={debts}
          onMerge={(ids) => {
            mergeDebts.mutate(ids, {
              onSuccess: () => setMergeDialogOpen(false),
            });
          }}
          isMerging={mergeDebts.isPending}
        />
      </div>
    </Page>
  );
}
