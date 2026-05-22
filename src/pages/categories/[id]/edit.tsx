import { useLocation, useParams } from "react-router-dom";
import { FormPage } from "@/components/shared";
import { CategoryForm } from "@/components/features/categories";
import { useCategory, useUpdateCategory } from "@/hooks";

export default function CategoryEditPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? "/categories";
  const { data: category, isLoading } = useCategory(id!);
  const updateCategory = useUpdateCategory(returnTo);

  return (
    <FormPage title="Edit Category" backLink={returnTo} isLoading={isLoading}>
      <CategoryForm
        defaultValues={category}
        onSubmit={(data) => updateCategory.mutate({ id: id!, data })}
        isSubmitting={updateCategory.isPending}
        submitLabel="Save"
      />
    </FormPage>
  );
}
