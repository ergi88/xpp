import { useSearchParams } from 'react-router-dom'
import { FormPage } from '@/components/shared'
import { RecurringForm } from '@/components/features/recurring'
import { useCreateRecurring, useTransaction } from '@/hooks'
import type { RecurringFormData } from '@/schemas'

export default function RecurringCreatePage() {
    const createRecurring = useCreateRecurring('/recurring')
    const [searchParams] = useSearchParams()
    const fromTransactionId = searchParams.get('from_transaction')
    const { data: source, isLoading } = useTransaction(fromTransactionId ?? '')

    const defaultValues: Partial<RecurringFormData> | undefined =
        fromTransactionId && source
            ? {
                  type: source.type as RecurringFormData['type'],
                  account_id: source.account.id,
                  to_account_id: source.toAccount?.id ?? null,
                  category_id: source.category?.id ?? null,
                  amount: source.amount,
                  to_amount: source.toAmount ?? null,
                  description: source.description ?? '',
                  frequency: 'monthly' as const,
                  interval: 1,
                  start_date: new Date().toISOString().slice(0, 10),
                  end_date: null,
                  is_active: true,
                  tag_ids: source.tags.map((t) => t.id),
                  created_from_transaction_id: source.id,
              }
            : undefined

    return (
        <FormPage
            title="New Recurring Transaction"
            backLink="/recurring"
            isLoading={!!fromTransactionId && isLoading}
        >
            <RecurringForm
                defaultValues={defaultValues}
                onSubmit={(data) => createRecurring.mutate(data)}
                isSubmitting={createRecurring.isPending}
                submitLabel="Create"
            />
        </FormPage>
    )
}
