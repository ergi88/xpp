import { adapter } from './client'
import type { Budget, BudgetFormData } from '@/types'

function toBudget(r: Record<string, unknown>): Budget {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: Number(r.amount),
    currencyId: (r.currency_id as string) ?? null,
    period: r.period as Budget['period'],
    periodLabel: r.period as string,
    startDate: (r.start_date as string) ?? null,
    endDate: (r.end_date as string) ?? null,
    isGlobal: r.is_global === 'true' || r.is_global === true,
    notifyAtPercent: r.notify_at_percent ? Number(r.notify_at_percent) : null,
    isActive: r.is_active === 'true' || r.is_active === true || r.is_active === undefined,
    categories: [],
    tags: [],
    createdAt: r.created_at as string | undefined,
  } as unknown as Budget
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
      currency_id: data.currency_id ?? '',
      category_ids: (data.category_ids ?? []).join(','),
      tag_ids: (data.tag_ids ?? []).join(','),
      period: data.period,
      start_date: data.start_date ?? '',
      end_date: data.end_date ?? '',
      is_global: String(data.is_global ?? false),
      notify_at_percent: data.notify_at_percent ?? '',
      is_active: String(data.is_active ?? true),
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
