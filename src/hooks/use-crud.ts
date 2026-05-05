import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adapter } from '@/api/client'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import type { SheetName } from '@/lib/sheets/adapter'

interface UseCrudOptions<T> {
    endpoint: SheetName
    queryKey: string[]
    redirectTo?: string
}

export function useCrud<T extends { id: string }>({
    endpoint,
    queryKey,
    redirectTo
}: UseCrudOptions<T>) {
    const qc = useQueryClient()
    const navigate = useNavigate()

    const list = useQuery({
        queryKey,
        queryFn: () => adapter.getAll(endpoint) as Promise<T[]>,
    })

    const create = useMutation({
        mutationFn: (data: Partial<T>) => adapter.create(endpoint, data as Record<string, unknown>) as Promise<T>,
        onSuccess: () => {
            toast.success('Created successfully')
            qc.invalidateQueries({ queryKey })
            if (redirectTo) navigate(redirectTo)
        },
    })

    const update = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
            adapter.update(endpoint, id, data as Record<string, unknown>) as Promise<T>,
        onSuccess: () => {
            toast.success('Updated successfully')
            qc.invalidateQueries({ queryKey })
            if (redirectTo) navigate(redirectTo)
        },
    })

    const remove = useMutation({
        mutationFn: (id: string) => adapter.delete(endpoint, id),
        onSuccess: () => {
            toast.success('Deleted successfully')
            qc.invalidateQueries({ queryKey })
        },
    })

    return { list, create, update, remove }
}

// Separate hook for fetching single item (avoids conditional hook call)
export function useCrudItem<T>(endpoint: SheetName, queryKey: string[], id: string) {
    return useQuery({
        queryKey: [...queryKey, id],
        queryFn: () => adapter.getById(endpoint, id) as Promise<T | null>,
        enabled: !!id,
    })
}
