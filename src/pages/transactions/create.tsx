import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FormPage } from '@/components/shared'
import { TransactionForm, PendingDebt } from '@/components/features/transactions'
import { useAccounts, useCategories, useCreateTransaction, useTags } from '@/hooks'
import { transactionsApi } from '@/api/transactions'
import { debtsApi } from '@/api/debts'
import { transactionSchema, TransactionFormValues } from '@/schemas'
import {
    parseTransactionIntent,
    type IntentParams,
    type ParsedIntent,
} from '@/lib/transaction-intent'
import { toast } from 'sonner'

export default function TransactionCreatePage() {
    const [type, setType] = useQueryState(
        'type',
        parseAsStringLiteral(['income', 'expense', 'transfer'] as const).withDefault('expense')
    )
    const [searchParams] = useSearchParams()

    // Deep-link prefill: an iOS Shortcut / bookmark / QR opens the form with
    // fields already filled, addressing categories, accounts and tags by name.
    // The params are frozen on first render — the form writes `type` back to the
    // URL as the user toggles it, and re-parsing then would wipe their edits.
    const initialParams = useRef<IntentParams | null>(null)
    if (initialParams.current === null) {
        initialParams.current = Object.fromEntries(searchParams.entries())
    }

    // Same query keys the form itself uses, so this reads the cache, not the network.
    const { data: accounts } = useAccounts({ active: true, exclude_debts: true })
    const { data: categories } = useCategories()
    const { data: tags } = useTags()

    const createTransaction = useCreateTransaction('/transactions')
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [isPendingWithDebt, setIsPendingWithDebt] = useState(false)

    const [intent, setIntent] = useState<ParsedIntent | null>(null)
    useEffect(() => {
        if (intent || !accounts || !categories || !tags) return
        setIntent(parseTransactionIntent(initialParams.current!, { accounts, categories, tags }))
    }, [intent, accounts, categories, tags])

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

    // Apply the parsed intent once: report what could not be resolved and, when
    // the link asked for `submit=1` and nothing was in doubt, save straight away.
    const intentApplied = useRef(false)
    useEffect(() => {
        if (!intent || intentApplied.current) return
        intentApplied.current = true

        if (intent.values.type !== type) setType(intent.values.type)

        if (intent.problems.length > 0) {
            toast.warning(
                intent.submitRequested
                    ? `Not saved — check the form: ${intent.problems.join('; ')}`
                    : intent.problems.join('; '),
                { duration: 8000 }
            )
        }
        if (!intent.autoSubmit) return

        const parsed = transactionSchema.safeParse(intent.values)
        if (!parsed.success) {
            toast.warning(`Not saved — ${parsed.error.issues[0]?.message ?? 'invalid link'}`)
            return
        }
        createTransaction.mutate(parsed.data)
        // createTransaction / setType are stable for the life of the page
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intent])

    const defaultValues = useMemo(
        () => ({
            ...(intent?.values ?? {}),
            type: (intent?.values.type ?? type) as TransactionFormValues['type'],
        }),
        [intent, type]
    )

    return (
        <FormPage title="New Transaction" backLink="/transactions">
            <TransactionForm
                defaultValues={defaultValues}
                onTypeChange={setType}
                onSubmit={handleSubmit}
                isSubmitting={createTransaction.isPending || isPendingWithDebt}
                submitLabel="Create"
            />
        </FormPage>
    )
}
