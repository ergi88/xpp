import { adapter } from './client'
import type { Account, AccountFormData } from '@/types'
import type { AccountsResponse, AccountsSummary, BalanceHistoryResponse, BalanceComparisonResponse } from '@/types'

export type { AccountsResponse, AccountsSummary, BalanceHistoryResponse, BalanceComparisonResponse }

function toAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Account['type'],
    currencyId: r.currency_id as string,
    initialBalance: Number(r.initial_balance ?? 0),
    currentBalance: Number(r.balance ?? 0),
    isActive: r.is_active === 'true' || r.is_active === true,
    createdAt: r.created_at as string | undefined,
  }
}

export const accountsApi = {
  getAll: async (params?: { active?: boolean; exclude_debts?: boolean }): Promise<Account[]> => {
    let rows = await adapter.getAll('accounts')
    if (params?.active) rows = rows.filter(r => r.is_active === 'true' || r.is_active === true)
    if (params?.exclude_debts) rows = rows.filter(r => r.type !== 'debt')
    return rows.map(toAccount)
  },

  getAllWithSummary: async (params?: { active?: boolean; exclude_debts?: boolean }): Promise<AccountsResponse> => {
    const accounts = await accountsApi.getAll(params)
    const total_balance = accounts.reduce((sum, a) => sum + a.currentBalance, 0)
    const summary: AccountsSummary = {
      total_balance,
      currency: 'USD',
      currency_code: 'USD',
      decimals: 2,
      accounts_count: accounts.length,
    }
    return { data: accounts, summary }
  },

  getById: async (id: string | number): Promise<Account> => {
    const r = await adapter.getById('accounts', String(id))
    if (!r) throw new Error('Account not found')
    return toAccount(r)
  },

  create: async (data: AccountFormData): Promise<Account> => {
    const r = await adapter.create('accounts', {
      id: crypto.randomUUID(),
      name: data.name,
      type: data.type,
      currency_id: data.currency_id,
      initial_balance: data.initial_balance ?? 0,
      balance: data.initial_balance ?? 0,
      is_active: String(data.is_active ?? true),
      created_at: new Date().toISOString(),
    })
    return toAccount(r)
  },

  update: async (id: string | number, data: Partial<AccountFormData>): Promise<Account> => {
    const r = await adapter.update('accounts', String(id), data as Record<string, unknown>)
    return toAccount(r)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('accounts', String(id)),

  updateBalance: (id: string, delta: number): Promise<Record<string, unknown>> =>
    accountsApi.getById(id).then(a =>
      adapter.update('accounts', id, { balance: a.currentBalance + delta })
    ),

  getBalanceHistory: async (params?: { start_date?: string; end_date?: string }): Promise<BalanceHistoryResponse> => {
    const { transactionsApi } = await import('./transactions')
    const [accounts, txns] = await Promise.all([
      accountsApi.getAll({ active: true }),
      transactionsApi.getAll(),
    ])
    const start = params?.start_date ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const end = params?.end_date ?? new Date().toISOString().slice(0, 10)
    const dates = eachDay(start, end)
    const series = accounts.map(acc => {
      let balance = acc.initialBalance
      const data = dates.map(date => {
        const dayTxns = (txns.data ?? []).filter(t => t.date <= date && t.account?.id === acc.id)
        balance = acc.initialBalance + dayTxns.reduce((sum, t) => {
          if (t.type === 'income') return sum + t.amount
          if (t.type === 'expense') return sum - t.amount
          return sum
        }, 0)
        return balance
      })
      return { name: acc.name, type: 'line', data }
    })
    return { dates, series, currency: 'USD', decimals: 2 }
  },

  getBalanceComparison: async (): Promise<BalanceComparisonResponse> => {
    const accounts = await accountsApi.getAll({ active: true })
    const current = accounts.reduce((s, a) => s + a.currentBalance, 0)
    return { current, previous: null, currency: 'USD', decimals: 2 }
  },
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = []
  const cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
