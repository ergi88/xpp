import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import { getBaseCurrencyMeta } from './accounts'
import type { Category, CategoryFormData, CategorySummaryResponse } from '@/types'

function toCategory(r: Record<string, unknown>): Category {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Category['type'],
    icon: r.icon as string,
    color: r.color as string,
    createdAt: r.created_at as string | undefined,
  }
}

export const categoriesApi = {
  getAll: async (): Promise<Category[]> =>
    (await adapter.getAll('categories')).map(toCategory),

  getById: async (id: string | number): Promise<Category> => {
    const r = await adapter.getById('categories', String(id))
    if (!r) throw new Error('Category not found')
    return toCategory(r)
  },

  create: async (data: CategoryFormData): Promise<Category> => {
    const r = await adapter.create('categories', {
      id: uuidv4(),
      name: data.name,
      type: data.type,
      icon: data.icon,
      color: data.color,
      created_at: new Date().toISOString(),
    })
    return toCategory(r)
  },

  update: async (id: string | number, data: Partial<CategoryFormData>): Promise<Category> => {
    const r = await adapter.update('categories', String(id), data as Record<string, unknown>)
    return toCategory(r)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('categories', String(id)),

  getByType: async (type: 'income' | 'expense'): Promise<Category[]> => {
    const all = await categoriesApi.getAll()
    return all.filter(c => c.type === type)
  },

  getSummary: async (params: {
    type: 'income' | 'expense'
    start_date?: string
    end_date?: string
  }): Promise<CategorySummaryResponse> => {
    const categories = await categoriesApi.getByType(params.type)
    const { currency } = await getBaseCurrencyMeta()
    return { data: categories, total: 0, currency }
  },
}
