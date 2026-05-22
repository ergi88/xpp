import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { debtsApi } from '@/api'
import { DebtFormData, DebtPaymentFormData } from '@/schemas'
import { toast } from 'sonner'

const QUERY_KEY = ['debts']

export function useDebts(params?: { include_completed?: boolean }) {
    return useQuery({
        queryKey: params ? [...QUERY_KEY, params] : QUERY_KEY,
        queryFn: () => debtsApi.getAll(params),
    })
}

export function useDebtsWithSummary(params?: { include_completed?: boolean }) {
    return useQuery({
        queryKey: [...QUERY_KEY, 'with-summary', params],
        queryFn: () => debtsApi.getAllWithSummary(params),
    })
}

export function useDebtSummary() {
    return useQuery({
        queryKey: [...QUERY_KEY, 'summary'],
        queryFn: () => debtsApi.getSummary(),
    })
}

export function useDebt(id: string | number) {
    return useQuery({
        queryKey: [...QUERY_KEY, id],
        queryFn: () => debtsApi.getById(id),
        enabled: !!id,
    })
}

export function useCreateDebt(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: (data: DebtFormData) => debtsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            toast.success('Debt created')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create debt')
        },
    })
}

export function useUpdateDebt(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: ({ id, data }: { id: string | number; data: Partial<DebtFormData> }) =>
            debtsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            toast.success('Debt updated')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update debt')
        },
    })
}

export function useDeleteDebt() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => debtsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            toast.success('Debt deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete debt')
        },
    })
}

export function useDebtPayment() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ debtId, data }: { debtId: string | number; data: DebtPaymentFormData }) =>
            debtsApi.makePayment(debtId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            toast.success('Payment recorded')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to record payment')
        },
    })
}

export function useDebtCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ debtId, data }: { debtId: string | number; data: DebtPaymentFormData }) =>
            debtsApi.collectPayment(debtId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            toast.success('Collection recorded')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to record collection')
        },
    })
}

export function useDebtTransactions(debtId: string | number) {
    return useQuery({
        queryKey: [...QUERY_KEY, debtId, 'transactions'],
        queryFn: () => debtsApi.getTransactionsForDebt(debtId),
        enabled: !!debtId,
    })
}

export function useLinkOriginTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, transactionId }: { id: string | number; transactionId: string }) =>
            debtsApi.update(id, { origin_transaction_id: transactionId } as Parameters<typeof debtsApi.update>[1]),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Origin transaction linked')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to link transaction')
        },
    })
}

export function useMergeDebts() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (debtIds: string[]) => debtsApi.merge(debtIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            toast.success('Debts merged')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to merge debts')
        },
    })
}

export function useReopenDebt() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => debtsApi.reopen(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Debt reopened')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to reopen debt')
        },
    })
}
