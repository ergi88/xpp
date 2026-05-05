import { useParams } from "react-router-dom";
import { FormPage } from "@/components/shared";
import { AccountForm } from "@/components/features/accounts";
import { useAccount, useUpdateAccount } from "@/hooks";

export default function AccountEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: account, isLoading } = useAccount(id!);
  const updateAccount = useUpdateAccount(`/accounts/${id}`);

  const defaultValues = account
    ? {
        name: account.name,
        type: account.type as "bank" | "crypto" | "cash" | "credit",
        currency_id: account.currencyId,
        initial_balance: account.type === 'credit'
          ? Math.abs(account.initialBalance)
          : account.initialBalance,
        is_active: account.isActive,
        card_last_digits: account.cardLastDigits ?? null,
        card_expiry: account.cardExpiry ?? null,
        credit_limit: account.creditLimit ?? null,
      }
    : undefined;

  return (
    <FormPage title="Edit Account" backLink={`/accounts/${id}`} isLoading={isLoading}>
      <AccountForm
        defaultValues={defaultValues}
        onSubmit={(data) => updateAccount.mutate({ id: id!, data })}
        isSubmitting={updateAccount.isPending}
        submitLabel="Save"
      />
    </FormPage>
  );
}
