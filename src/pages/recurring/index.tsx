import { useMemo, useState } from "react";
import { ListPage } from "@/components/shared";
import { createRecurringColumns } from "@/components/features/recurring";
import { useRecurring, useDeleteRecurring, useSkipRecurring } from "@/hooks";

export default function RecurringPage() {
  const [search, setSearch] = useState("");
  const { data: recurring, isLoading } = useRecurring();
  const deleteRecurring = useDeleteRecurring();
  const skipRecurring = useSkipRecurring();
  const isReadOnly = false;

  const columns = createRecurringColumns({
    onDelete: (id) => deleteRecurring.mutate(id),
    onSkip: (id) => skipRecurring.mutate(id),
    isReadOnly,
  });

  const filteredRecurring = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recurring ?? [];

    return (recurring ?? []).filter((r) => {
      const desc = r.description ?? "";
      const acc = r.account?.name ?? "";
      const cat = r.category?.name ?? "";
      return [desc, acc, cat].some((v) => v.toLowerCase().includes(q));
    });
  }, [search, recurring]);

  return (
    <ListPage
      title="Recurring Transactions"
      // description="Manage automatically repeating transactions"
      createLink="/recurring/create"
      createLabel="New Recurring"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search recurring",
      }}
      data={filteredRecurring}
      columns={columns}
      isLoading={isLoading}
    />
  );
}
