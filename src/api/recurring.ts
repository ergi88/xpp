import { adapter } from './client'
import type { RecurringTransaction } from '@/types'
import type { RecurringFormData } from '@/schemas'
import { accountsApi } from './accounts'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'

function toRecurring(
  r: Record<string, unknown>,
  accountMap: Map<string, unknown>,
  categoryMap: Map<string, unknown>,
  tagMap: Map<string, unknown>,
): RecurringTransaction {
  const tagIds = r.tag_ids ? String(r.tag_ids).split(',').filter(Boolean) : []
  return {
    id: r.id as string,
    type: r.type as RecurringTransaction['type'],
    accountId: r.account_id as string,
    toAccountId: r.to_account_id as string | undefined,
    categoryId: r.category_id as string | undefined,
    amount: Number(r.amount),
    toAmount: r.to_amount ? Number(r.to_amount) : undefined,
    description: r.description as string | undefined,
    frequency: r.frequency as RecurringTransaction['frequency'],
    frequencyLabel: r.frequency as string,
    interval: Number(r.interval ?? 1),
    startDate: r.start_date as string,
    endDate: r.end_date as string | undefined,
    nextRunDate: r.next_run_date as string,
    lastRunDate: r.last_run_date as string | undefined,
    isActive: r.is_active === 'true' || r.is_active === true,
    account: accountMap.get(r.account_id as string) as RecurringTransaction['account'],
    toAccount: r.to_account_id ? accountMap.get(r.to_account_id as string) as RecurringTransaction['toAccount'] : undefined,
    category: r.category_id ? categoryMap.get(r.category_id as string) as RecurringTransaction['category'] : undefined,
    tags: tagIds.map(tid => tagMap.get(tid)).filter(Boolean) as RecurringTransaction['tags'],
    createdAt: r.created_at as string | undefined,
  }
}

export const recurringApi = {
  getAll: async (): Promise<RecurringTransaction[]> => {
    const [rows, accounts, categories, tags] = await Promise.all([
      adapter.getAll('recurring'),
      accountsApi.getAll(),
      categoriesApi.getAll(),
      tagsApi.getAll(),
    ])
    const accountMap = new Map(accounts.map(a => [a.id, a]))
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const tagMap = new Map(tags.map(t => [t.id, t]))
    return rows.map(r => toRecurring(r, accountMap, categoryMap, tagMap))
  },

  getById: async (id: string | number): Promise<RecurringTransaction> => {
    const [r, accounts, categories, tags] = await Promise.all([
      adapter.getById('recurring', String(id)),
      accountsApi.getAll(),
      categoriesApi.getAll(),
      tagsApi.getAll(),
    ])
    if (!r) throw new Error('Recurring not found')
    const accountMap = new Map(accounts.map(a => [a.id, a]))
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const tagMap = new Map(tags.map(t => [t.id, t]))
    return toRecurring(r, accountMap, categoryMap, tagMap)
  },

  create: async (data: RecurringFormData): Promise<RecurringTransaction> => {
    await adapter.create('recurring', {
      id: crypto.randomUUID(),
      type: data.type,
      account_id: data.account_id,
      to_account_id: data.to_account_id ?? '',
      category_id: data.category_id ?? '',
      amount: data.amount,
      to_amount: data.to_amount ?? '',
      description: data.description ?? '',
      frequency: data.frequency,
      interval: data.interval,
      start_date: data.start_date,
      end_date: data.end_date ?? '',
      next_run_date: data.start_date,
      is_active: String(data.is_active),
      tag_ids: (data.tag_ids ?? []).join(','),
      created_at: new Date().toISOString(),
    })
    return recurringApi.getAll().then(all => all.find(r => r.accountId === String(data.account_id))!)
  },

  update: async (id: string | number, data: Partial<RecurringFormData>): Promise<RecurringTransaction> => {
    await adapter.update('recurring', String(id), {
      ...data,
      tag_ids: data.tag_ids ? data.tag_ids.join(',') : undefined,
    } as Record<string, unknown>)
    return recurringApi.getById(id)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('recurring', String(id)),

  skip: async (id: string | number): Promise<RecurringTransaction> =>
    recurringApi.getById(id),

  getUpcoming: async (): Promise<RecurringTransaction[]> => {
    const all = await recurringApi.getAll()
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    return all.filter(r => r.isActive && r.nextRunDate >= today && r.nextRunDate <= in30)
      .sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate))
  },
}
