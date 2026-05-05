import { useParams } from 'react-router-dom'
import { FormPage } from '@/components/shared'
import { RecurringForm } from '@/components/features/recurring'
import { useRecurringById, useUpdateRecurring } from '@/hooks'
import { RecurringFormData } from '@/schemas'

export default function RecurringEditPage() {
    const { id } = useParams<{ id: string }>()
    const { data: recurring, isLoading } = useRecurringById(id!)
    const updateRecurring = useUpdateRecurring('/recurring')

    const defaultValues: Partial<RecurringFormData> | undefined = recurring ? {
        type: recurring.type as RecurringFormData['type'],
        account_id: recurring.accountId,
        to_account_id: recurring.toAccountId ?? null,
        category_id: recurring.categoryId ?? null,
        amount: recurring.amount,
        to_amount: recurring.toAmount ?? null,
        description: recurring.description,
        frequency: recurring.frequency,
        interval: recurring.interval,
        day_of_week: recurring.dayOfWeek ?? null,
        day_of_month: recurring.dayOfMonth ?? null,
        start_date: recurring.startDate,
        end_date: recurring.endDate ?? null,
        is_active: recurring.isActive,
        tag_ids: recurring.tags.map(t => t.id),
    } : undefined

    return (
        <FormPage title="Edit Recurring Transaction" backLink="/recurring" isLoading={isLoading}>
            <RecurringForm
                defaultValues={defaultValues}
                onSubmit={(data) => updateRecurring.mutate({ id: id!, data })}
                isSubmitting={updateRecurring.isPending}
                submitLabel="Save"
            />
        </FormPage>
    )
}
