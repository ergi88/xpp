import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { transactionsApi } from '@/api'
import type { TransactionFilters } from '@/types'
import type { TransactionFormValues, SplitChildFormData } from '@/schemas'
type TransactionFormData = TransactionFormValues
import { toast } from 'sonner'
import {
    buildTxFailureNotification,
    notificationsStore,
} from '@/lib/notifications'

const QUERY_KEY = ['transactions']

export function useTransactions(filters?: TransactionFilters & { with_summary?: boolean }) {
    return useQuery({
        queryKey: filters ? [...QUERY_KEY, filters] : QUERY_KEY,
        queryFn: () => transactionsApi.getAll(filters),
    })
}

export function useTransaction(id: string | number) {
    return useQuery({
        queryKey: [...QUERY_KEY, id],
        queryFn: () => transactionsApi.getById(id),
        enabled: !!id,
    })
}

export function useCreateTransaction(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: (data: TransactionFormData) => transactionsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transaction created')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error, variables) => {
            toast.error(error.message || 'Failed to create transaction')
            notificationsStore.push(
                buildTxFailureNotification(
                    'tx_create_failed',
                    {
                        txPayload: variables,
                        accountId: variables.account_id,
                        toAccountId: variables.to_account_id ?? undefined,
                        debtId: variables.debt_id ?? undefined,
                    },
                    error,
                ),
            )
        },
    })
}

export function useUpdateTransaction(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: ({ id, data }: { id: string | number; data: Partial<TransactionFormData> }) =>
            transactionsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transaction updated')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error, variables) => {
            toast.error(error.message || 'Failed to update transaction')
            notificationsStore.push(
                buildTxFailureNotification(
                    'tx_update_failed',
                    {
                        txId: String(variables.id),
                        txPayload: variables.data,
                        accountId: variables.data.account_id,
                        toAccountId: variables.data.to_account_id ?? undefined,
                        debtId: variables.data.debt_id ?? undefined,
                    },
                    error,
                ),
            )
        },
    })
}

type DeleteVariables =
    | string
    | number
    | { id: string | number; skipEffects?: boolean }

function normalizeDeleteVariables(v: DeleteVariables) {
    if (typeof v === 'object') return { id: v.id, skipEffects: v.skipEffects === true }
    return { id: v, skipEffects: false }
}

export function useDeleteTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (variables: DeleteVariables) => {
            const { id, skipEffects } = normalizeDeleteVariables(variables)
            return transactionsApi.delete(id, { skipEffects })
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            const { skipEffects } = normalizeDeleteVariables(variables)
            toast.success(
                skipEffects
                    ? 'Transaction deleted (balances untouched)'
                    : 'Transaction deleted',
            )
        },
        onError: (error: Error, variables) => {
            toast.error(error.message || 'Failed to delete transaction')
            const { id } = normalizeDeleteVariables(variables)
            notificationsStore.push(
                buildTxFailureNotification(
                    'tx_delete_failed',
                    { txId: String(id) },
                    error,
                ),
            )
        },
    })
}

export function useDuplicateTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => transactionsApi.duplicate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transaction duplicated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to duplicate transaction')
        },
    })
}

export function useTransactionSummary(filters?: TransactionFilters) {
    return useQuery({
        queryKey: [...QUERY_KEY, 'summary', filters],
        queryFn: () => transactionsApi.getSummary(filters),
    })
}

export function useToggleTransactionFlag() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: {
            id: string | number
            flag: 'is_excluded' | 'is_one_time' | 'is_approved'
            value: boolean
        }) => {
            return transactionsApi.update(params.id, { [params.flag]: params.value })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transaction updated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update transaction')
        },
    })
}

export function useSplitTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: {
            parentId: string | number
            children: SplitChildFormData[]
        }) => {
            return transactionsApi.split(params.parentId, params.children)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            queryClient.invalidateQueries({ queryKey: ['debts'] })
            toast.success('Transaction split saved')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to split transaction')
        },
    })
}

export function useUnsplitTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => transactionsApi.unsplit(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            queryClient.invalidateQueries({ queryKey: ['debts'] })
            toast.success('Transaction unsplit')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to unsplit')
        },
    })
}

export function useLinkCounterpart() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (params: { idA: string | number; idB: string | number }) =>
            transactionsApi.linkCounterpart(params.idA, params.idB),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Counterpart linked')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to link counterpart')
        },
    })
}

export function useUnlinkCounterpart() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => transactionsApi.unlinkCounterpart(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Counterpart unlinked')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to unlink')
        },
    })
}

export function useBulkDeleteTransactions() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (ids: string[]) => {
            for (const id of ids) {
                await transactionsApi.delete(id)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transactions deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete transactions')
        },
    })
}

export interface BulkCreateResult {
    ok: boolean
    index: number
    error?: Error
}

export function useBulkCreateTransactions() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (drafts: TransactionFormData[]): Promise<BulkCreateResult[]> => {
            // Sequential: each create runs its own account/debt side-effects
            // (applyTransactionEffects), so there is no true batch write. One
            // failure must not abort the rest — collect per-row outcomes.
            const results: BulkCreateResult[] = []
            for (let i = 0; i < drafts.length; i++) {
                try {
                    await transactionsApi.create(drafts[i])
                    results.push({ ok: true, index: i })
                } catch (error) {
                    results.push({ ok: false, index: i, error: error as Error })
                }
            }
            return results
        },
        onSuccess: (results) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            const ok = results.filter((r) => r.ok).length
            const failed = results.length - ok
            if (failed === 0) {
                toast.success(`${ok} transaction${ok === 1 ? '' : 's'} created`)
            } else if (ok === 0) {
                toast.error(`Failed to create ${failed} transaction${failed === 1 ? '' : 's'}`)
            } else {
                toast.warning(`${ok} created · ${failed} failed`)
            }
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create transactions')
        },
    })
}

export function useBulkUpdateTransactions() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ ids, data }: { ids: string[]; data: { category_id?: string } }) => {
            for (const id of ids) {
                await transactionsApi.update(id, data as any)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transactions updated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update transactions')
        },
    })
}
