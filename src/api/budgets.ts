import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import { categoriesApi } from './categories'
import { currenciesApi } from './currencies'
import { tagsApi } from './tags'
import type { Budget, BudgetFormData, Category, Currency, Tag } from '@/types'

function toBudget(r: Record<string, unknown>): Omit<Budget, 'categories' | 'tags'> {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: Number(r.amount),
    currencyId: (r.currency_id as string) || null,
    period: r.period as Budget['period'],
    periodLabel: r.period as string,
    startDate: (r.start_date as string) || null,
    endDate: (r.end_date as string) || null,
    isGlobal: r.is_global === 'true' || r.is_global === true,
    notifyAtPercent: r.notify_at_percent ? Number(r.notify_at_percent) : null,
    isActive: r.is_active === 'true' || r.is_active === true || r.is_active === undefined,
    createdAt: r.created_at as string | undefined,
  } as unknown as Omit<Budget, 'categories' | 'tags'>
}

function resolveRelations(
  raw: Record<string, unknown>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
  currenciesById: Map<string, Currency>,
): Budget {
  const categoryIds = String(raw.category_ids ?? '').split(',').filter(Boolean)
  const tagIds = String(raw.tag_ids ?? '').split(',').filter(Boolean)
  const base = toBudget(raw)
  return {
    ...base,
    currency: base.currencyId ? currenciesById.get(base.currencyId) : undefined,
    categories: categoryIds.map(id => categoriesById.get(id)).filter(Boolean) as Category[],
    tags: tagIds.map(id => tagsById.get(id)).filter(Boolean) as Tag[],
  } as Budget
}

async function buildLookups() {
  const [allCategories, allTags, allCurrencies] = await Promise.all([
    categoriesApi.getAll(),
    tagsApi.getAll(),
    currenciesApi.getAll(),
  ])
  const categoriesById = new Map(allCategories.map(c => [c.id, c]))
  const tagsById = new Map(allTags.map(t => [t.id, t]))
  const currenciesById = new Map(allCurrencies.map(c => [c.id, c]))
  return { categoriesById, tagsById, currenciesById }
}

export const budgetsApi = {
  getAll: async (): Promise<Budget[]> => {
    const [rows, { categoriesById, tagsById, currenciesById }] = await Promise.all([
      adapter.getAll('budgets'),
      buildLookups(),
    ])
    return rows.map(r => resolveRelations(r, categoriesById, tagsById, currenciesById))
  },

  getById: async (id: string | number): Promise<Budget> => {
    const [r, { categoriesById, tagsById, currenciesById }] = await Promise.all([
      adapter.getById('budgets', String(id)),
      buildLookups(),
    ])
    if (!r) throw new Error('Budget not found')
    return resolveRelations(r, categoriesById, tagsById, currenciesById)
  },

  create: async (data: BudgetFormData): Promise<Budget> => {
    const [r, { categoriesById, tagsById, currenciesById }] = await Promise.all([
      adapter.create('budgets', {
        id: uuidv4(),
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
      }),
      buildLookups(),
    ])
    return resolveRelations(r, categoriesById, tagsById, currenciesById)
  },

  update: async (id: string | number, data: Partial<BudgetFormData>): Promise<Budget> => {
    const payload: Record<string, unknown> = { ...data }
    if (Array.isArray(data.category_ids)) {
      payload.category_ids = data.category_ids.join(',')
    }
    if (Array.isArray(data.tag_ids)) {
      payload.tag_ids = data.tag_ids.join(',')
    }
    const [r, { categoriesById, tagsById, currenciesById }] = await Promise.all([
      adapter.update('budgets', String(id), payload),
      buildLookups(),
    ])
    return resolveRelations(r, categoriesById, tagsById, currenciesById)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('budgets', String(id)),
}
