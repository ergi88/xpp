import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { templatesApi } from '@/api'
import { TemplateFormData } from '@/schemas'
import { toast } from 'sonner'

const QUERY_KEY = ['templates']

export function useTemplates() {
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => templatesApi.getAll(),
    })
}

export function useTemplateById(id: string | number) {
    return useQuery({
        queryKey: [...QUERY_KEY, id],
        queryFn: () => templatesApi.getById(id),
        enabled: !!id,
    })
}

export function useCreateTemplate(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: (data: TemplateFormData) => templatesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Template created')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create template')
        },
    })
}

export function useUpdateTemplate(redirectTo?: string) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: ({ id, data }: { id: string | number; data: Partial<TemplateFormData> }) =>
            templatesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Template updated')
            if (redirectTo) navigate(redirectTo)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update template')
        },
    })
}

export function useDeleteTemplate() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => templatesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            toast.success('Template deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete template')
        },
    })
}
