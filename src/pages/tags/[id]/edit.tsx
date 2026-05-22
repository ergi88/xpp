import { useLocation, useParams } from "react-router-dom";
import { FormPage } from "@/components/shared";
import { TagForm } from "@/components/features/tags";
import { useTag, useUpdateTag } from "@/hooks";

export default function TagEditPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? "/tags";
  const { data: tag, isLoading } = useTag(id!);
  const updateTag = useUpdateTag(returnTo);

  const defaultValues = tag
    ? {
        name: tag.name,
      }
    : undefined;

  return (
    <FormPage title="Edit Tag" backLink={returnTo} isLoading={isLoading}>
      <TagForm
        defaultValues={defaultValues}
        onSubmit={(data) => updateTag.mutate({ id: id!, data })}
        isSubmitting={updateTag.isPending}
        submitLabel="Save"
      />
    </FormPage>
  );
}
