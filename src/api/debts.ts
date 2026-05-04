import { adapter } from './client'
import { transactionsApi } from './transactions'
import type { Debt, DebtFormData, DebtPaymentFormData, DebtSummary, DebtsResponse, Transaction } from '@/types'

function toDebt(r: Record<string, unknown>): Debt {
  const targetAmount = Number(r.target_amount ?? r.amount ?? 0)
  const paidAmount = Number(r.paid_amount ?? 0)
  const remainingDebt = Math.max(0, targetAmount - paidAmount)
  return {
    id: r.id as string,
    name: r.name as string,
    type: 'debt',
    debtType: r.debt_type as Debt['debtType'],
    debtTypeLabel: r.debt_type as string,
    currencyId: r.currency_id as string,
    targetAmount,
    currentBalance: paidAmount,
    remainingDebt,
    paymentProgress: targetAmount > 0 ? (paidAmount / targetAmount) * 100 : 0,
    dueDate: r.due_date as string | undefined,
    counterparty: r.counterparty as string | undefined,
    description: r.description as string | undefined,
    isPaidOff: remainingDebt <= 0,
    isActive: remainingDebt > 0,
    createdAt: r.created_at as string | undefined,
  }
}

export const debtsApi = {
  getAll: async (params?: { include_completed?: boolean }): Promise<Debt[]> => {
    const rows = await adapter.getAll('debts')
    const debts = rows.map(toDebt)
    return params?.include_completed ? debts : debts.filter(d => d.isActive)
  },

  getAllWithSummary: async (params?: { include_completed?: boolean }): Promise<DebtsResponse> => {
    const data = await debtsApi.getAll(params)
    const iOwe = data.filter(d => d.debtType === 'i_owe')
    const owedToMe = data.filter(d => d.debtType === 'owed_to_me')
    const summary: DebtSummary = {
      total_i_owe: iOwe.reduce((s, d) => s + d.remainingDebt, 0),
      total_owed_to_me: owedToMe.reduce((s, d) => s + d.remainingDebt, 0),
      net_debt: iOwe.reduce((s, d) => s + d.remainingDebt, 0) - owedToMe.reduce((s, d) => s + d.remainingDebt, 0),
      debts_count: data.length,
      currency: 'USD',
      decimals: 2,
    }
    return { data, summary }
  },

  getById: async (id: string | number): Promise<Debt> => {
    const r = await adapter.getById('debts', String(id))
    if (!r) throw new Error('Debt not found')
    return toDebt(r)
  },

  create: async (data: DebtFormData): Promise<Debt> => {
    const r = await adapter.create('debts', {
      id: crypto.randomUUID(),
      name: data.name,
      debt_type: data.debt_type,
      currency_id: String(data.currency_id),
      target_amount: data.amount,
      paid_amount: 0,
      due_date: data.due_date ?? '',
      counterparty: data.counterparty ?? '',
      description: data.description ?? '',
      created_at: new Date().toISOString(),
    })
    return toDebt(r)
  },

  update: async (id: string | number, data: Partial<DebtFormData>): Promise<Debt> => {
    const r = await adapter.update('debts', String(id), data as Record<string, unknown>)
    return toDebt(r)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('debts', String(id)),

  makePayment: async (debtId: string | number, data: DebtPaymentFormData): Promise<Transaction> => {
    const debt = await debtsApi.getById(debtId)
    const newPaid = debt.currentBalance + data.amount
    await adapter.update('debts', String(debtId), { paid_amount: newPaid })
    return transactionsApi.create({
      type: 'expense',
      account_id: data.account_id,
      amount: data.amount,
      date: data.date,
      description: data.description ?? `Payment for ${debt.name}`,
    })
  },

  collectPayment: async (debtId: string | number, data: DebtPaymentFormData): Promise<Transaction> => {
    const debt = await debtsApi.getById(debtId)
    const newPaid = debt.currentBalance + data.amount
    await adapter.update('debts', String(debtId), { paid_amount: newPaid })
    return transactionsApi.create({
      type: 'income',
      account_id: data.account_id,
      amount: data.amount,
      date: data.date,
      description: data.description ?? `Collection for ${debt.name}`,
    })
  },

  reopen: async (id: string | number): Promise<Debt> => {
    const r = await adapter.update('debts', String(id), { paid_amount: 0 })
    return toDebt(r)
  },

  getSummary: async (): Promise<DebtSummary> => {
    const res = await debtsApi.getAllWithSummary()
    return res.summary!
  },
}
