import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateAccount = vi.fn()
const updateDebt = vi.fn()

vi.mock('@/api/accounts', () => ({
  accountsApi: { updateBalance: (...args: unknown[]) => updateAccount(...args) },
  getBaseCurrencyMeta: vi.fn(),
  isAccountIncludedInBaseAggregates: vi.fn(() => true),
}))
vi.mock('@/api/debts', () => ({
  debtsApi: {
    updateBalance: (...args: unknown[]) => updateDebt(...args),
    // Test debts default to debtType='i_owe' so (expense + i_owe) settles
    // (+amount * sign). Override per test if needed.
    getById: vi.fn(async () => ({ debtType: 'i_owe' })),
  },
}))

import { applyTransactionEffects } from '@/api/transaction-effects'
import type { Transaction } from '@/types'

function txn(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    type: 'expense',
    amount: 100,
    date: '2026-05-01',
    account: { id: 'a1' } as Transaction['account'],
    items: [],
    tags: [],
    isExcluded: false,
    isOneTime: false,
    parentId: null,
    debtId: null,
    linkedTransactionId: null,
    recurringId: null,
    ...overrides,
  } as Transaction
}

beforeEach(() => {
  updateAccount.mockReset()
  updateDebt.mockReset()
})

describe('applyTransactionEffects', () => {
  it('expense +1: account -amount', async () => {
    await applyTransactionEffects(txn({ id: 't', type: 'expense', amount: 100 }), 1)
    expect(updateAccount).toHaveBeenCalledWith('a1', -100)
  })
  it('expense -1: account +amount (reversal)', async () => {
    await applyTransactionEffects(txn({ id: 't', type: 'expense', amount: 100 }), -1)
    expect(updateAccount).toHaveBeenCalledWith('a1', 100)
  })
  it('income +1: account +amount', async () => {
    await applyTransactionEffects(txn({ id: 't', type: 'income', amount: 50 }), 1)
    expect(updateAccount).toHaveBeenCalledWith('a1', 50)
  })
  it('transfer +1: from -amount, to +to_amount', async () => {
    await applyTransactionEffects(
      txn({
        id: 't',
        type: 'transfer',
        amount: 100,
        toAmount: 95,
        toAccount: { id: 'a2' } as Transaction['toAccount'],
      }),
      1,
    )
    expect(updateAccount).toHaveBeenCalledWith('a1', -100)
    expect(updateAccount).toHaveBeenCalledWith('a2', 95)
  })
  it('transfer +1 with no to_amount: uses amount on both sides', async () => {
    await applyTransactionEffects(
      txn({
        id: 't',
        type: 'transfer',
        amount: 100,
        toAmount: undefined,
        toAccount: { id: 'a2' } as Transaction['toAccount'],
      }),
      1,
    )
    expect(updateAccount).toHaveBeenCalledWith('a1', -100)
    expect(updateAccount).toHaveBeenCalledWith('a2', 100)
  })
  it('split child (parentId set): no account mutation', async () => {
    await applyTransactionEffects(txn({ id: 't', parentId: 'p1' }), 1)
    expect(updateAccount).not.toHaveBeenCalled()
  })
  it('debtId set: increases debt paid by amount (parent-level)', async () => {
    await applyTransactionEffects(txn({ id: 't', type: 'expense', amount: 40, debtId: 'd1' }), 1)
    expect(updateAccount).toHaveBeenCalledWith('a1', -40)
    expect(updateDebt).toHaveBeenCalledWith('d1', 40)
  })
  it('debtId set with sign=-1: reverses debt paid', async () => {
    await applyTransactionEffects(txn({ id: 't', type: 'expense', amount: 40, debtId: 'd1' }), -1)
    expect(updateDebt).toHaveBeenCalledWith('d1', -40)
  })
})
