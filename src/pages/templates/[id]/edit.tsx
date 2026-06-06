import { useParams } from "react-router-dom";
import { FormPage } from "@/components/shared";
import { TemplateForm } from "@/components/features/templates";
import { useTemplateById, useUpdateTemplate } from "@/hooks";
import type { TemplateFormData } from "@/schemas";

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useTemplateById(id!);
  const updateTemplate = useUpdateTemplate("/templates");

  const defaultValues: Partial<TemplateFormData> | undefined = template
    ? {
        name: template.name,
        icon: template.icon ?? "",
        type: template.type as TemplateFormData["type"],
        account_id: template.accountId,
        to_account_id: template.toAccountId ?? null,
        category_id: template.categoryId ?? null,
        amount: template.amount ?? null,
        description: template.description ?? "",
        tag_ids: template.tags.map((t) => t.id),
      }
    : undefined;

  return (
    <FormPage title="Edit Template" backLink="/templates" isLoading={isLoading}>
      <TemplateForm
        defaultValues={defaultValues}
        onSubmit={(data) => updateTemplate.mutate({ id: id!, data })}
        isSubmitting={updateTemplate.isPending}
        submitLabel="Save"
      />
    </FormPage>
  );
}
