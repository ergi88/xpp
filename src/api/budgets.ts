import { adapter } from './client'
import type { Budget, BudgetFormData } from '@/types'

function toBudget(r: Record<string, unknown>): Budget {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: Number(r.amount),
    categoryId: r.category_id as string,
    period: r.period as Budget['period'],
    startDate: r.start_date as string,
    endDate: r.end_date as string | undefined,
    createdAt: r.created_at as string | undefined,
  } as Budget
}

export const budgetsApi = {
  getAll: async (): Promise<Budget[]> =>
    (await adapter.getAll('budgets')).map(toBudget),

  getById: async (id: string | number): Promise<Budget> => {
    const r = await adapter.getById('budgets', String(id))
    if (!r) throw new Error('Budget not found')
    return toBudget(r)
  },

  create: async (data: BudgetFormData): Promise<Budget> => {
    const r = await adapter.create('budgets', {
      id: crypto.randomUUID(),
      name: data.name,
      amount: data.amount,
      category_id: data.category_id,
      period: data.period,
      start_date: data.start_date,
      end_date: data.end_date ?? '',
      created_at: new Date().toISOString(),
    })
    return toBudget(r)
  },

  update: async (id: string | number, data: Partial<BudgetFormData>): Promise<Budget> => {
    const r = await adapter.update('budgets', String(id), data as Record<string, unknown>)
    return toBudget(r)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('budgets', String(id)),
}
