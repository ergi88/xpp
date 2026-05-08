import { ListPage } from "@/components/shared";
import { createAccountColumns } from "@/components/features/accounts";
import { useAccounts, useDeleteAccount, useCurrencies } from "@/hooks";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const deleteAccount = useDeleteAccount();
  const isReadOnly = false;
  const { data: currencies } = useCurrencies();

  const enrichedAccounts = accounts
    ?.filter((a) => a.type !== "debt")
    .map((a) => ({
      ...a,
      currency:
        currencies?.find((c) => c.id.toString() === a.currencyId) || undefined,
    }));

  const columns = createAccountColumns(
    (id) => deleteAccount.mutate(id),
    isReadOnly,
  );

  return (
    <ListPage
      title="Accounts"
      description="Manage your bank accounts, cash and crypto wallets"
      createLink="/accounts/create"
      createLabel="New Account"
      data={enrichedAccounts ?? []}
      columns={columns}
      isLoading={isLoading}
    />
  );
}
