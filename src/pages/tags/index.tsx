import { useMemo, useState } from "react";
import { ListPage } from "@/components/shared";
import { createTagColumns } from "@/components/features/tags";
import { useTags, useDeleteTag } from "@/hooks";

export default function TagsPage() {
    const [search, setSearch] = useState("");
    const { data: tags, isLoading } = useTags();
    const deleteTag = useDeleteTag();
    const isReadOnly = false;

    const columns = createTagColumns((id) => deleteTag.mutate(id), isReadOnly);

    const filteredTags = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tags ?? [];

        return (tags ?? []).filter((t) =>
            (t.name ?? "").toLowerCase().includes(q),
        );
    }, [search, tags]);

    return (
        <ListPage
            title="Tags"
            description="Organize transactions with tags"
            createLink="/tags/create"
            createLabel="New Tag"
            search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search tags",
            }}
            data={filteredTags}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="No tags found"
            emptyDescription="Create your first tag to organize transactions"
        />
    );
}
