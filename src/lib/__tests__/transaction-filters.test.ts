import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import {
  excludeExcluded,
  excludeOneTime,
  excludeSplitChildren,
  collapseLinkedPairs,
} from '@/lib/transaction-filters'

function txn(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 10,
    date: overrides.date ?? '2026-05-01',
    account: overrides.account ?? ({ id: 'a1' } as Transaction['account']),
    items: [],
    tags: [],
    isExcluded: overrides.isExcluded ?? false,
    isOneTime: overrides.isOneTime ?? false,
    parentId: overrides.parentId ?? null,
    debtId: overrides.debtId ?? null,
    linkedTransactionId: overrides.linkedTransactionId ?? null,
    recurringId: overrides.recurringId ?? null,
    ...overrides,
  } as Transaction
}

describe('excludeExcluded', () => {
  it('removes rows with isExcluded=true', () => {
    const list = [txn({ id: '1' }), txn({ id: '2', isExcluded: true }), txn({ id: '3' })]
    expect(excludeExcluded(list).map(t => t.id)).toEqual(['1', '3'])
  })
})

describe('excludeOneTime', () => {
  it('removes rows with isOneTime=true', () => {
    const list = [txn({ id: '1' }), txn({ id: '2', isOneTime: true })]
    expect(excludeOneTime(list).map(t => t.id)).toEqual(['1'])
  })
})

describe('excludeSplitChildren', () => {
  it('removes rows with parentId set', () => {
    const list = [txn({ id: '1' }), txn({ id: '2', parentId: 'p1' })]
    expect(excludeSplitChildren(list).map(t => t.id)).toEqual(['1'])
  })
})

describe('collapseLinkedPairs', () => {
  it('keeps the first of a mutually-linked pair, drops the second', () => {
    const a = txn({ id: 'a', linkedTransactionId: 'b' })
    const b = txn({ id: 'b', linkedTransactionId: 'a' })
    const c = txn({ id: 'c' })
    expect(collapseLinkedPairs([a, b, c]).map(t => t.id)).toEqual(['a', 'c'])
  })
  it('keeps unlinked rows untouched', () => {
    const list = [txn({ id: '1' }), txn({ id: '2' })]
    expect(collapseLinkedPairs(list).map(t => t.id)).toEqual(['1', '2'])
  })
})
