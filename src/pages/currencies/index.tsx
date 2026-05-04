import { useMemo, useState } from "react";
import { ListPage } from "@/components/shared";
import { createCurrencyColumns } from "@/components/features/currencies";
import { useCurrencies, useDeleteCurrency, useSetBaseCurrency } from "@/hooks";
import { useReadOnly } from "@/components/providers/ReadOnlyProvider";

export default function CurrenciesPage() {
    const [search, setSearch] = useState("");
    const { data: currencies, isLoading } = useCurrencies();
    const deleteCurrency = useDeleteCurrency();
    const setBaseCurrency = useSetBaseCurrency();
    const isReadOnly = useReadOnly();

    const columns = createCurrencyColumns({
        onDelete: (id) => deleteCurrency.mutate(id),
        onSetBase: (id) => setBaseCurrency.mutate(id),
        isSettingBase: setBaseCurrency.isPending,
        currencyCount: currencies?.length ?? 0,
        isReadOnly,
    });

    const filteredCurrencies = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return currencies ?? [];

        return (currencies ?? []).filter((c) => {
            const code = c.code ?? "";
            const name = c.name ?? "";
            return [code, name].some((v) => v.toLowerCase().includes(q));
        });
    }, [search, currencies]);

    return (
        <ListPage
            title="Currencies"
            description="Manage currencies and exchange rates"
            createLink="/currencies/create"
            createLabel="New Currency"
            search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search currencies",
            }}
            data={filteredCurrencies}
            columns={columns}
            isLoading={isLoading}
        />
    );
}
