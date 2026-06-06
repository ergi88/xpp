import { useSearchParams } from "react-router-dom";
import { FormPage } from "@/components/shared";
import { TemplateForm } from "@/components/features/templates";
import { useCreateTemplate, useTransaction } from "@/hooks";
import type { TemplateFormData } from "@/schemas";

export default function TemplateCreatePage() {
  const createTemplate = useCreateTemplate("/templates");
  const [searchParams] = useSearchParams();
  const fromTransactionId = searchParams.get("from_transaction");
  const { data: source, isLoading } = useTransaction(fromTransactionId ?? "");

  const defaultValues: Partial<TemplateFormData> | undefined =
    fromTransactionId && source
      ? {
          // Seed a sensible name from the transaction's description/category
          // so the required name field isn't empty; user can rename.
          name: source.description || source.category?.name || "",
          icon: "",
          type: source.type as TemplateFormData["type"],
          account_id: source.account.id,
          to_account_id: source.toAccount?.id ?? null,
          category_id: source.category?.id ?? null,
          amount: source.amount,
          description: source.description ?? "",
          tag_ids: source.tags.map((t) => t.id),
        }
      : undefined;

  return (
    <FormPage
      title="New Template"
      backLink="/templates"
      isLoading={!!fromTransactionId && isLoading}
    >
      <TemplateForm
        defaultValues={defaultValues}
        onSubmit={(data) => createTemplate.mutate(data)}
        isSubmitting={createTemplate.isPending}
        submitLabel="Create"
      />
    </FormPage>
  );
}
