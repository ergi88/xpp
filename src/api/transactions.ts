import { adapter } from './client'
import {
  accountsApi,
  getBaseCurrencyMeta,
  isAccountIncludedInBaseAggregates,
} from './accounts'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'
import type { Transaction, TransactionFilters, TransactionSummary } from '@/types'
import type { TransactionFormValues as TransactionFormData } from '@/schemas'

export interface TransactionsResponse {
  data: Transaction[]
  summary?: TransactionSummary
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number
    to: number
  }
}

async function loadLookups() {
  const [accounts, categories, tags] = await Promise.all([
    accountsApi.getAll(),
    categoriesApi.getAll(),
    tagsApi.getAll(),
  ])
  return {
    accountMap: new Map(accounts.map(a => [a.id, a])),
    categoryMap: new Map(categories.map(c => [c.id, c])),
    tagMap: new Map(tags.map(t => [t.id, t])),
  }
}

function toTransaction(
  r: Record<string, unknown>,
  accountMap: Map<string, unknown>,
  categoryMap: Map<string, unknown>,
  tagMap: Map<string, unknown>,
): Transaction {
  const tagIds = r.tag_ids ? String(r.tag_ids).split(',').filter(Boolean) : []
  return {
    id: r.id as string,
    type: r.type as Transaction['type'],
    amount: Number(r.amount),
    toAmount: r.to_amount ? Number(r.to_amount) : undefined,
    exchangeRate: r.exchange_rate ? Number(r.exchange_rate) : undefined,
    description: r.description as string | undefined,
    date: r.date as string,
    account: accountMap.get(r.account_id as string) as Transaction['account'],
    toAccount: r.to_account_id ? accountMap.get(r.to_account_id as string) as Transaction['toAccount'] : undefined,
    category: r.category_id ? categoryMap.get(r.category_id as string) as Transaction['category'] : undefined,
    items: [],
    tags: tagIds.map(tid => tagMap.get(tid)).filter(Boolean) as Transaction['tags'],
    createdAt: r.created_at as string,
  }
}

function applyFilters(txns: Transaction[], filters: TransactionFilters): Transaction[] {
  let result = txns
  if (filters.type) result = result.filter(t => t.type === filters.type)
  if (filters.account_id) result = result.filter(t => t.account?.id === String(filters.account_id))
  if (filters.account_ids?.length) result = result.filter(t => filters.account_ids!.includes(t.account?.id))
  if (filters.category_id) result = result.filter(t => t.category?.id === String(filters.category_id))
  if (filters.category_ids?.length) result = result.filter(t => t.category && filters.category_ids!.map(String).includes(t.category.id))
  if (filters.tag_ids?.length) result = result.filter(t => t.tags.some(tag => filters.tag_ids!.map(String).includes(tag.id)))
  if (filters.start_date) result = result.filter(t => t.date >= filters.start_date!)
  if (filters.end_date) result = result.filter(t => t.date <= filters.end_date!)
  if (filters.sort_by) {
    const dir = filters.sort_direction === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      const va = filters.sort_by === 'amount' ? a.amount
               : filters.sort_by === 'created_at' ? (a.createdAt ?? '')
               : a.date
      const vb = filters.sort_by === 'amount' ? b.amount
               : filters.sort_by === 'created_at' ? (b.createdAt ?? '')
               : b.date
      return va < vb ? -dir : va > vb ? dir : 0
    })
  } else {
    result = [...result].sort((a, b) => b.date.localeCompare(a.date))
  }
  return result
}

function isTransactionIncludedInBaseAggregates(
  transaction: Transaction,
  baseCurrencyId?: string,
): boolean {
  return !!(
    transaction.account &&
    isAccountIncludedInBaseAggregates(transaction.account, baseCurrencyId ? { id: baseCurrencyId } : undefined)
  )
}

export const transactionsApi = {
  getAll: async (filters?: TransactionFilters & { with_summary?: boolean; per_page?: number; page?: number }): Promise<TransactionsResponse> => {
    const [rows, lookups] = await Promise.all([
      adapter.getAll('transactions'),
      loadLookups(),
    ])
    let txns = rows.map(r => toTransaction(r, lookups.accountMap, lookups.categoryMap, lookups.tagMap))
    if (filters) txns = applyFilters(txns, filters)

    const perPage = filters?.per_page ?? 50
    const page = filters?.page ?? 1
    const total = txns.length
    const from = (page - 1) * perPage
    const paginated = txns.slice(from, from + perPage)

    let summary: TransactionSummary | undefined
    if (filters?.with_summary) {
      const { baseCurrency, currency } = await getBaseCurrencyMeta()
      const aggregateTxns = txns.filter((transaction) =>
        isTransactionIncludedInBaseAggregates(transaction, baseCurrency?.id),
      )
      summary = {
        income: aggregateTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: aggregateTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        balance: 0,
        transactions_count: aggregateTxns.length,
        currency,
      }
      summary.balance = summary.income - summary.expense
    }

    return {
      data: paginated,
      summary,
      meta: {
        current_page: page,
        last_page: Math.ceil(total / perPage),
        per_page: perPage,
        total,
        from: from + 1,
        to: Math.min(from + perPage, total),
      },
    }
  },

  getById: async (id: string | number): Promise<Transaction> => {
    const [r, lookups] = await Promise.all([
      adapter.getById('transactions', String(id)),
      loadLookups(),
    ])
    if (!r) throw new Error('Transaction not found')
    return toTransaction(r, lookups.accountMap, lookups.categoryMap, lookups.tagMap)
  },

  create: async (data: TransactionFormData): Promise<Transaction> => {
    const id = crypto.randomUUID()
    const row = {
      id,
      type: data.type,
      account_id: String(data.account_id),
      to_account_id: data.to_account_id ? String(data.to_account_id) : '',
      category_id: data.category_id ? String(data.category_id) : '',
      amount: data.amount,
      to_amount: data.to_amount ?? '',
      exchange_rate: data.exchange_rate ?? '',
      description: data.description ?? '',
      date: data.date,
      tag_ids: (data.tag_ids ?? []).join(','),
      created_at: new Date().toISOString(),
    }
    await adapter.create('transactions', row)

    if (data.type === 'income') {
      await accountsApi.updateBalance(String(data.account_id), data.amount)
    } else if (data.type === 'expense') {
      await accountsApi.updateBalance(String(data.account_id), -data.amount)
    } else if (data.type === 'transfer' && data.to_account_id) {
      await Promise.all([
        accountsApi.updateBalance(String(data.account_id), -data.amount),
        accountsApi.updateBalance(String(data.to_account_id), data.to_amount ?? data.amount),
      ])
    }

    return transactionsApi.getById(id)
  },

  update: async (id: string | number, data: Partial<TransactionFormData>): Promise<Transaction> => {
    const existing = await transactionsApi.getById(id)
    await adapter.update('transactions', String(id), {
      ...data,
      tag_ids: data.tag_ids ? data.tag_ids.join(',') : undefined,
    } as Record<string, unknown>)

    if (existing.type === 'income') {
      await accountsApi.updateBalance(existing.account.id, -existing.amount)
    } else if (existing.type === 'expense') {
      await accountsApi.updateBalance(existing.account.id, existing.amount)
    } else if (existing.type === 'transfer') {
      await Promise.all([
        accountsApi.updateBalance(existing.account.id, existing.amount),
        existing.toAccount && accountsApi.updateBalance(existing.toAccount.id, -(existing.toAmount ?? existing.amount)),
      ].filter(Boolean) as Promise<unknown>[])
    }
    const updated = await transactionsApi.getById(id)
    if (updated.type === 'income') {
      await accountsApi.updateBalance(updated.account.id, updated.amount)
    } else if (updated.type === 'expense') {
      await accountsApi.updateBalance(updated.account.id, -updated.amount)
    } else if (updated.type === 'transfer') {
      await Promise.all([
        accountsApi.updateBalance(updated.account.id, -updated.amount),
        updated.toAccount && accountsApi.updateBalance(updated.toAccount.id, updated.toAmount ?? updated.amount),
      ].filter(Boolean) as Promise<unknown>[])
    }
    return updated
  },

  delete: async (id: string | number): Promise<void> => {
    const existing = await transactionsApi.getById(id)
    await adapter.delete('transactions', String(id))
    if (existing.type === 'income') {
      await accountsApi.updateBalance(existing.account.id, -existing.amount)
    } else if (existing.type === 'expense') {
      await accountsApi.updateBalance(existing.account.id, existing.amount)
    } else if (existing.type === 'transfer') {
      await Promise.all([
        accountsApi.updateBalance(existing.account.id, existing.amount),
        existing.toAccount && accountsApi.updateBalance(existing.toAccount.id, -(existing.toAmount ?? existing.amount)),
      ].filter(Boolean) as Promise<unknown>[])
    }
  },

  duplicate: async (id: string | number): Promise<Transaction> => {
    const existing = await transactionsApi.getById(id)
    return transactionsApi.create({
      type: existing.type as 'income' | 'expense' | 'transfer',
      account_id: existing.account.id as unknown as string,
      to_account_id: existing.toAccount?.id as unknown as string | undefined,
      category_id: existing.category?.id as unknown as string | undefined,
      amount: existing.amount,
      to_amount: existing.toAmount,
      description: existing.description,
      date: new Date().toISOString().slice(0, 10),
      tag_ids: existing.tags.map(t => t.id) as unknown as string[],
    })
  },

  getSummary: async (filters?: TransactionFilters): Promise<TransactionSummary> => {
    const res = await transactionsApi.getAll({ ...filters, with_summary: true, per_page: 99999 })
    return res.summary!
  },
}
