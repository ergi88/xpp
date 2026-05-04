import { ListPage } from "@/components/shared";
import { createAccountColumns } from "@/components/features/accounts";
import { useAccounts, useDeleteAccount } from "@/hooks";

export default function AccountsPage() {
    const { data: accounts, isLoading } = useAccounts({ exclude_debts: true });
    const deleteAccount = useDeleteAccount();
    const isReadOnly = false;

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
            data={accounts ?? []}
            columns={columns}
            isLoading={isLoading}
        />
    );
}
