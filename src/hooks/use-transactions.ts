import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { transactionsApi } from '@/api'
import type { TransactionFilters } from '@/types'
import type { TransactionFormValues, SplitChildFormData } from '@/schemas'
type TransactionFormData = TransactionFormValues
import { toast } from 'sonner'

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
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create transaction')
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
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update transaction')
        },
    })
}

export function useDeleteTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => transactionsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transaction deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete transaction')
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
            flag: 'is_excluded' | 'is_one_time'
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
