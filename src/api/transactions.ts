import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import {
  accountsApi,
  getBaseCurrencyMeta,
  isAccountIncludedInBaseAggregates,
} from './accounts'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'
import { applyTransactionEffects } from './transaction-effects'
import { debtsApi } from './debts'
import type { Transaction, TransactionFilters, TransactionSummary } from '@/types'
import type { TransactionFormValues as TransactionFormData, SplitChildFormData } from '@/schemas'
import { toBool, toIdOrNull } from '@/lib/coerce'
import {
  collapseLinkedPairs,
  excludeSplitChildren,
  excludeExcluded,
} from '@/lib/transaction-filters'

// Returns the delta-to-paid_amount sign for a transaction-on-debt side-effect.
// "Same direction" (expense → i_owe, income → owed_to_me) settles the debt:
// delta is +amount, paid_amount goes up, remaining goes down. "Opposite
// direction" (expense → owed_to_me lending, income → i_owe rare) is treated
// as growing the debt: delta is -amount, paid_amount goes down (can go
// negative), remaining grows.
async function debtDeltaSign(debtId: string, txnType: 'income' | 'expense' | 'transfer'): Promise<1 | -1> {
  const debt = await debtsApi.getById(debtId)
  const same =
    (txnType === 'expense' && debt.debtType === 'i_owe') ||
    (txnType === 'income' && debt.debtType === 'owed_to_me')
  return same ? 1 : -1
}

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

function toLocalDateString(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(raw as string)
  if (isNaN(d.getTime())) return String(raw).slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
    date: toLocalDateString(r.date),
    account: accountMap.get(r.account_id as string) as Transaction['account'],
    toAccount: r.to_account_id ? accountMap.get(r.to_account_id as string) as Transaction['toAccount'] : undefined,
    category: r.category_id ? categoryMap.get(r.category_id as string) as Transaction['category'] : undefined,
    tags: tagIds.map(tid => tagMap.get(tid)).filter(Boolean) as Transaction['tags'],
    isExcluded: toBool(r.is_excluded),
    isOneTime: toBool(r.is_one_time),
    // Phase 5 fix: missing column = legacy row = treat as approved.
    isApproved: r.is_approved === undefined || r.is_approved === '' || r.is_approved === null ? true : toBool(r.is_approved),
    parentId: toIdOrNull(r.parent_id),
    debtId: toIdOrNull(r.debt_id),
    linkedTransactionId: toIdOrNull(r.linked_transaction_id),
    recurringId: toIdOrNull(r.recurring_id),
    createdAt: r.created_at as string,
  }
}

function applyFilters(txns: Transaction[], filters: TransactionFilters): Transaction[] {
  let result = txns
  // Hide split children unless explicitly requested, BUT keep them when the
  // caller is filtering by category/categories — the children carry the
  // real attribution and the user clearly wants per-category rows.
  const hasCategoryFilter =
    !!filters.category_id || (filters.category_ids?.length ?? 0) > 0
  if (!filters.include_split_children && !hasCategoryFilter) {
    result = result.filter(t => !t.parentId)
  }
  // When category-filtering, also drop parents whose own (possibly stale)
  // category matches but who have been split — their children cover the row.
  if (hasCategoryFilter) {
    const parentIdsWithChildren = new Set<string>()
    for (const t of result) {
      if (!t.parentId && t.children && t.children.length > 0) parentIdsWithChildren.add(t.id)
    }
    result = result.filter(t => !parentIdsWithChildren.has(t.id))
  }
  // Hide excluded unless explicitly requested
  if (!filters.include_excluded) {
    result = result.filter(t => !t.isExcluded)
  }
  if (filters.type) result = result.filter(t => t.type === filters.type)
  if (filters.types?.length) result = result.filter(t => filters.types!.includes(t.type))
  if (filters.account_id) result = result.filter(t => t.account?.id === String(filters.account_id))
  if (filters.account_ids?.length) result = result.filter(t => !!t.account && filters.account_ids!.includes(t.account.id))
  if (filters.category_id) result = result.filter(t => t.category?.id === String(filters.category_id))
  if (filters.category_ids?.length) result = result.filter(t => t.category && filters.category_ids!.map(String).includes(t.category.id))
  if (filters.tag_ids?.length) result = result.filter(t => t.tags.some(tag => filters.tag_ids!.map(String).includes(tag.id)))
  if (filters.start_date) result = result.filter(t => t.date.slice(0, 10) >= filters.start_date!)
  if (filters.end_date) result = result.filter(t => t.date.slice(0, 10) <= filters.end_date!)
  if (filters.sort_by) {
    const dir = filters.sort_direction === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      const va = filters.sort_by === 'amount' ? a.amount
               : filters.sort_by === 'created_at' ? (a.createdAt ?? a.date)
               : a.date
      const vb = filters.sort_by === 'amount' ? b.amount
               : filters.sort_by === 'created_at' ? (b.createdAt ?? b.date)
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

    // Phase 3: group children under parents. Children remain in the flat
    // list so `include_split_children: true` callers can still see them;
    // parents additionally gain `.children` and `.childrenCount`.
    const childrenByParent = new Map<string, Transaction[]>()
    for (const t of txns) {
      if (t.parentId) {
        const arr = childrenByParent.get(t.parentId) ?? []
        arr.push(t)
        childrenByParent.set(t.parentId, arr)
      }
    }
    for (const t of txns) {
      if (!t.parentId) {
        const c = childrenByParent.get(t.id)
        if (c && c.length > 0) {
          t.children = c
          t.childrenCount = c.length
        }
      }
    }

    if (filters) txns = applyFilters(txns, filters)

    const perPage = filters?.per_page ?? 50
    const page = filters?.page ?? 1
    const total = txns.length
    const from = (page - 1) * perPage
    const paginated = txns.slice(from, from + perPage)

    let summary: TransactionSummary | undefined
    if (filters?.with_summary) {
      const { baseCurrency, currency } = await getBaseCurrencyMeta()
      let aggregateTxns = txns.filter((transaction) =>
        isTransactionIncludedInBaseAggregates(transaction, baseCurrency?.id),
      )
      // Phase 2 matrix: summary tiles skip excluded, hide split children, collapse linked pairs.
      aggregateTxns = collapseLinkedPairs(aggregateTxns)
      aggregateTxns = excludeSplitChildren(aggregateTxns)
      aggregateTxns = excludeExcluded(aggregateTxns)
      const income = aggregateTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = aggregateTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      summary = {
        income,
        expense,
        transfer: aggregateTxns.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
        balance: income - expense,
        transactions_count: aggregateTxns.length,
        currency,
        decimals: baseCurrency?.decimals ?? 2,
      }
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
    // Phase 3: load full list so we can attach children to the parent.
    // Cheaper than a separate getAll filtered by parent_id (GAS has no filtering).
    const [allRows, lookups] = await Promise.all([
      adapter.getAll('transactions'),
      loadLookups(),
    ])
    const all = allRows.map(r => toTransaction(r, lookups.accountMap, lookups.categoryMap, lookups.tagMap))
    const target = all.find(t => String(t.id) === String(id))
    if (!target) throw new Error('Transaction not found')
    if (!target.parentId) {
      const children = all.filter(t => t.parentId === target.id)
      if (children.length > 0) {
        target.children = children
        target.childrenCount = children.length
      }
    }
    return target
  },

  create: async (data: TransactionFormData): Promise<Transaction> => {
    const id = uuidv4()
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
      is_excluded: data.is_excluded ? 'true' : 'false',
      is_one_time: data.is_one_time ? 'true' : 'false',
      is_approved: data.is_approved === false ? 'false' : 'true',
      parent_id: data.parent_id ?? '',
      debt_id: data.debt_id ?? '',
      linked_transaction_id: data.linked_transaction_id ?? '',
      recurring_id: data.recurring_id ?? '',
      created_at: new Date().toISOString(),
    }
    await adapter.create('transactions', row)

    const created = await transactionsApi.getById(id)
    await applyTransactionEffects(created, 1)

    // Phase 3: persist children if provided.
    if (data.children && data.children.length > 0) {
      for (const c of data.children) {
        const childRow = {
          id: uuidv4(),
          type: data.type,
          account_id: String(data.account_id),
          to_account_id: '',
          category_id: c.category_id ? String(c.category_id) : '',
          amount: c.amount,
          to_amount: '',
          exchange_rate: '',
          description: c.description ?? '',
          date: data.date,
          tag_ids: '',
          is_excluded: 'false',
          is_one_time: 'false',
          parent_id: id,
          debt_id: c.debt_id ? String(c.debt_id) : '',
          linked_transaction_id: '',
          recurring_id: '',
          created_at: new Date().toISOString(),
        }
        await adapter.create('transactions', childRow)

        // Apply debt-balance side-effect on debt-linked children, signed
        // by debt direction (see debtDeltaSign).
        if (c.debt_id) {
          const sign = await debtDeltaSign(String(c.debt_id), data.type)
          await debtsApi.updateBalance(String(c.debt_id), c.amount * sign)
        }
      }
      // Re-fetch so children are attached on the returned object
      return transactionsApi.getById(id)
    }

    return created
  },

  update: async (id: string | number, data: Partial<TransactionFormData>): Promise<Transaction> => {
    const existing = await transactionsApi.getById(id)
    await adapter.update('transactions', String(id), {
      ...data,
      tag_ids: data.tag_ids ? data.tag_ids.join(',') : undefined,
      is_excluded: data.is_excluded === undefined ? undefined : (data.is_excluded ? 'true' : 'false'),
      is_one_time: data.is_one_time === undefined ? undefined : (data.is_one_time ? 'true' : 'false'),
      is_approved: data.is_approved === undefined ? undefined : (data.is_approved ? 'true' : 'false'),
      parent_id: data.parent_id ?? undefined,
      debt_id: data.debt_id ?? undefined,
      linked_transaction_id: data.linked_transaction_id ?? undefined,
      recurring_id: data.recurring_id ?? undefined,
    } as Record<string, unknown>)

    await applyTransactionEffects(existing, -1)
    const updated = await transactionsApi.getById(id)
    await applyTransactionEffects(updated, 1)
    return updated
  },

  delete: async (id: string | number): Promise<void> => {
    const existing = await transactionsApi.getById(id)

    // Cascade: delete all children first, reversing each child's debt effects.
    if (existing.children && existing.children.length > 0) {
      for (const child of existing.children) {
        if (child.debtId) {
          const sign = await debtDeltaSign(child.debtId, existing.type)
          await debtsApi.updateBalance(child.debtId, -child.amount * sign)
        }
        await adapter.delete('transactions', String(child.id))
      }
    }

    await adapter.delete('transactions', String(id))
    await applyTransactionEffects(existing, -1)
  },

  split: async (parentId: string | number, children: SplitChildFormData[]): Promise<Transaction> => {
    const parent = await transactionsApi.getById(parentId)

    // Validate sum equals parent amount within 0.01.
    const sum = children.reduce((s, c) => s + c.amount, 0)
    if (Math.abs(sum - parent.amount) > 0.01) {
      throw new Error(`Children total (${sum.toFixed(2)}) must equal parent amount (${parent.amount.toFixed(2)})`)
    }

    // Delete any existing children first (idempotent re-split).
    if (parent.children && parent.children.length > 0) {
      for (const c of parent.children) {
        if (c.debtId) {
          const sign = await debtDeltaSign(c.debtId, parent.type)
          await debtsApi.updateBalance(c.debtId, -c.amount * sign)
        }
        await adapter.delete('transactions', String(c.id))
      }
    }

    // Write new children.
    for (const c of children) {
      const childRow = {
        id: uuidv4(),
        type: parent.type,
        account_id: parent.account.id,
        to_account_id: '',
        category_id: c.category_id ? String(c.category_id) : '',
        amount: c.amount,
        to_amount: '',
        exchange_rate: '',
        description: c.description ?? '',
        date: parent.date,
        tag_ids: '',
        is_excluded: 'false',
        is_one_time: 'false',
        parent_id: String(parentId),
        debt_id: c.debt_id ? String(c.debt_id) : '',
        linked_transaction_id: '',
        recurring_id: '',
        created_at: new Date().toISOString(),
      }
      await adapter.create('transactions', childRow)
      if (c.debt_id) {
        const sign = await debtDeltaSign(String(c.debt_id), parent.type)
        await debtsApi.updateBalance(String(c.debt_id), c.amount * sign)
      }
    }

    return transactionsApi.getById(parentId)
  },

  unsplit: async (parentId: string | number): Promise<Transaction> => {
    const parent = await transactionsApi.getById(parentId)
    if (parent.children && parent.children.length > 0) {
      for (const c of parent.children) {
        if (c.debtId) {
          const sign = await debtDeltaSign(c.debtId, parent.type)
          await debtsApi.updateBalance(c.debtId, -c.amount * sign)
        }
        await adapter.delete('transactions', String(c.id))
      }
    }
    return transactionsApi.getById(parentId)
  },

  linkCounterpart: async (idA: string | number, idB: string | number): Promise<void> => {
    const [a, b] = await Promise.all([
      transactionsApi.getById(idA),
      transactionsApi.getById(idB),
    ])
    if (a.linkedTransactionId) {
      throw new Error('Source transaction is already linked')
    }
    if (b.linkedTransactionId) {
      throw new Error('Target transaction is already linked')
    }
    await Promise.all([
      adapter.update('transactions', String(idA), { linked_transaction_id: String(idB) }),
      adapter.update('transactions', String(idB), { linked_transaction_id: String(idA) }),
    ])
  },

  unlinkCounterpart: async (id: string | number): Promise<void> => {
    const t = await transactionsApi.getById(id)
    if (!t.linkedTransactionId) return
    await Promise.all([
      adapter.update('transactions', String(id), { linked_transaction_id: '' }),
      adapter.update('transactions', String(t.linkedTransactionId), { linked_transaction_id: '' }),
    ])
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
