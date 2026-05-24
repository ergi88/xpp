import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Play } from "lucide-react";
import { FormPage } from "@/components/shared";
import { RecurringForm } from "@/components/features/recurring";
import {
  useRecurringById,
  useUpdateRecurring,
  useRunNowRecurring,
  useTransactions,
} from "@/hooks";
import { RecurringFormData } from "@/schemas";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/shared/AmountText";
import { useFABActions } from "@/lib/fab-context";

export default function RecurringEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: recurring, isLoading } = useRecurringById(id!);
  const updateRecurring = useUpdateRecurring("/recurring");
  const runNow = useRunNowRecurring();
  const { data: txnsResp } = useTransactions({
    per_page: 9999,
    include_excluded: true,
    include_split_children: false,
  });

  useFABActions(
    [
      {
        id: "back",
        label: "Go back",
        icon: ArrowLeft,
        onClick: () => navigate(-1),
      },
      {
        id: "run-now",
        label: "Run now",
        icon: Play,
        onClick: () => runNow.mutate(id!),
        // disabled: runNow.isPending,
      },
    ],
    [id],
  );

  const generated = (txnsResp?.data ?? []).filter((t) => t.recurringId === id);

  const defaultValues: Partial<RecurringFormData> | undefined = recurring
    ? {
        type: recurring.type as RecurringFormData["type"],
        account_id: recurring.accountId,
        to_account_id: recurring.toAccountId ?? null,
        category_id: recurring.categoryId ?? null,
        amount: recurring.amount,
        to_amount: recurring.toAmount ?? null,
        description: recurring.description,
        frequency: recurring.frequency,
        interval: recurring.interval,
        day_of_week: recurring.dayOfWeek ?? null,
        day_of_month: recurring.dayOfMonth ?? null,
        start_date: recurring.startDate,
        end_date: recurring.endDate ?? null,
        is_active: recurring.isActive,
        tag_ids: recurring.tags.map((t) => t.id),
      }
    : undefined;

  return (
    <FormPage
      title="Edit Recurring Transaction"
      backLink="/recurring"
      isLoading={isLoading}
    >
      <RecurringForm
        defaultValues={defaultValues}
        onSubmit={(data) => updateRecurring.mutate({ id: id!, data })}
        isSubmitting={updateRecurring.isPending}
        submitLabel="Save"
      />

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => runNow.mutate(id!)}
          disabled={runNow.isPending}
        >
          <Play className="size-4 mr-1" />
          {runNow.isPending ? "Running..." : "Run now"}
        </Button>
      </div>

      <div className="mt-6 space-y-2">
        <h3 className="font-medium">
          Generated transactions ({generated.length})
        </h3>
        {generated.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="border rounded-lg divide-y">
            {generated.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/transactions/${t.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {t.description || (
                        <span className="italic text-muted-foreground">
                          No description
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="font-mono tabular-nums">
                    <AmountText
                      value={t.amount}
                      decimals={t.account.currency?.decimals ?? 2}
                      currency={t.account.currency?.symbol}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormPage>
  );
}
