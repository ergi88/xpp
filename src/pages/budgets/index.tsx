import { useMemo, useState } from "react";
import { ListPage } from "@/components/shared";
import { createBudgetColumns } from "@/components/features/budgets";
import { useBudgetsWithProgress, useDeleteBudget } from "@/hooks";

export default function BudgetsPage() {
    const [search, setSearch] = useState("");
    const { data: budgets, isLoading } = useBudgetsWithProgress();
    const deleteBudget = useDeleteBudget();
    const isReadOnly = false;

    const filteredBudgets = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return budgets ?? [];

        return (budgets ?? []).filter((b) =>
            (b.name ?? "").toLowerCase().includes(q),
        );
    }, [search, budgets]);

    const columns = createBudgetColumns(
        (id) => deleteBudget.mutate(id),
        isReadOnly,
    );

    return (
        <ListPage
            title="Budgets"
            description="Set spending limits for categories"
            createLink="/budgets/create"
            createLabel="New Budget"
            search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search budgets",
            }}
            data={filteredBudgets}
            columns={columns}
            isLoading={isLoading}
        />
    );
}
