import { useMemo, useState } from "react";
import { ListPage } from "@/components/shared";
import { createTemplateColumns } from "@/components/features/templates";
import { useTemplates, useDeleteTemplate } from "@/hooks";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const isReadOnly = false;

  const columns = createTemplateColumns({
    onDelete: (id) => deleteTemplate.mutate(id),
    isReadOnly,
  });

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates ?? [];

    return (templates ?? []).filter((t) => {
      const name = t.name ?? "";
      const desc = t.description ?? "";
      const acc = t.account?.name ?? "";
      const cat = t.category?.name ?? "";
      return [name, desc, acc, cat].some((v) => v.toLowerCase().includes(q));
    });
  }, [search, templates]);

  return (
    <ListPage
      title="Templates"
      createLink="/templates/create"
      createLabel="New Template"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search templates",
      }}
      data={filteredTemplates}
      columns={columns}
      isLoading={isLoading}
    />
  );
}
