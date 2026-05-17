import { useState } from 'react'
import { useQueryState, parseAsStringLiteral, parseAsFloat, parseAsString } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FormPage } from '@/components/shared'
import { TransactionForm, PendingDebt } from '@/components/features/transactions'
import { useCreateTransaction } from '@/hooks'
import { transactionsApi } from '@/api/transactions'
import { debtsApi } from '@/api/debts'
import { TransactionFormValues } from '@/schemas'
import { toast } from 'sonner'

export default function TransactionCreatePage() {
    const [type, setType] = useQueryState(
        'type',
        parseAsStringLiteral(['income', 'expense', 'transfer'] as const).withDefault('expense')
    )
    const [amount] = useQueryState('amount', parseAsFloat)
    const [description] = useQueryState('description', parseAsString)

    const createTransaction = useCreateTransaction('/transactions')
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [isPendingWithDebt, setIsPendingWithDebt] = useState(false)

    const handleSubmit = async (data: TransactionFormValues, pendingDebt?: PendingDebt | null) => {
        if (pendingDebt) {
            setIsPendingWithDebt(true)
            try {
                const txn = await transactionsApi.create(data)
                await debtsApi.create({
                    name: pendingDebt.name,
                    debt_type: pendingDebt.debtType,
                    currency_id: txn.account.currency!.id,
                    amount: txn.amount,
                    origin_transaction_id: txn.id,
                })
                queryClient.invalidateQueries({ queryKey: ['transactions'] })
                queryClient.invalidateQueries({ queryKey: ['accounts'] })
                queryClient.invalidateQueries({ queryKey: ['debts'] })
                toast.success('Transaction and debt created')
                navigate('/transactions')
            } catch (err) {
                toast.error((err as Error).message || 'Failed to create transaction')
            } finally {
                setIsPendingWithDebt(false)
            }
        } else {
            createTransaction.mutate(data)
        }
    }

    return (
        <FormPage title="New Transaction" backLink="/transactions">
            <TransactionForm
                defaultValues={{
                    type: type as TransactionFormValues['type'],
                    amount: amount ?? undefined,
                    description: description ?? undefined,
                }}
                onTypeChange={setType}
                onSubmit={handleSubmit}
                isSubmitting={createTransaction.isPending || isPendingWithDebt}
                submitLabel="Create"
            />
        </FormPage>
    )
}
