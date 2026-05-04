import { useMemo, useState } from "react";
import { ListPage } from "@/components/shared";
import { createCategoryColumns } from "@/components/features/categories";
import { useCategories, useDeleteCategory } from "@/hooks";

export default function CategoriesPage() {
    const [search, setSearch] = useState("");
    const { data: categories, isLoading } = useCategories();
    const deleteCategory = useDeleteCategory();
    const isReadOnly = false;

    const typeCounts = useMemo(
        () => ({
            income: categories?.filter((c) => c.type === "income").length ?? 0,
            expense:
                categories?.filter((c) => c.type === "expense").length ?? 0,
        }),
        [categories],
    );

    const columns = createCategoryColumns(
        (id) => deleteCategory.mutate(id),
        typeCounts,
        isReadOnly,
    );

    const filteredCategories = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return categories ?? [];

        return (categories ?? []).filter((c) => {
            const name = c.name ?? "";
            const type = c.type ?? "";
            return [name, type].some((v) => v.toLowerCase().includes(q));
        });
    }, [search, categories]);

    return (
        <ListPage
            title="Categories"
            description="Manage income and expense categories"
            createLink="/categories/create"
            createLabel="New Category"
            search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search categories",
            }}
            data={filteredCategories}
            columns={columns}
            isLoading={isLoading}
        />
    );
}
