import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { recurringApi } from '@/api'
import { RecurringFormData } from '@/schemas'
import { toast } from 'sonner'

const QUERY_KEY = ['recurring']

export function useRecurring() {
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => recurringApi.getAll(),
    })
}

export function useRecurringById(id: string | number) {
    return useQuery({
        queryKey: [...QUERY_KEY, id],
        queryFn: () => recurringApi.getById(id),
        enabled: !!id,
    })
}

export function useUpcomingRecurring() {
    return useQuery({
        queryKey: [...QUERY_KEY, 'upcoming'],
        queryFn: () => recurringApi.getUpcoming(),
    })
}

export function useCreateRecurring(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: (data: RecurringFormData) => recurringApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Recurring transaction created')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create recurring transaction')
        },
    })
}

export function useUpdateRecurring(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: ({ id, data }: { id: string | number; data: Partial<RecurringFormData> }) =>
            recurringApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Recurring transaction updated')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update recurring transaction')
        },
    })
}

export function useDeleteRecurring() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => recurringApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Recurring transaction deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete recurring transaction')
        },
    })
}

export function useSkipRecurring() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => recurringApi.skip(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Skipped next occurrence')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to skip')
        },
    })
}

export function useRunDueRecurring() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => recurringApi.runDueRecurring(),
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            if (count > 0) toast.success(`${count} recurring transaction${count === 1 ? '' : 's'} generated`)
        },
    })
}

export function useRunNowRecurring() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => recurringApi.runNow(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['budgets-with-progress'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Recurring transaction generated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to run recurring')
        },
    })
}
