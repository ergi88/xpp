import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import {
  excludeExcluded,
  excludeOneTime,
  excludeSplitChildren,
  collapseLinkedPairs,
  expandSplitChildrenForCategoryView,
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

describe('expandSplitChildrenForCategoryView', () => {
  it('returns the input unchanged when no split parents/children exist', () => {
    const list = [txn({ id: '1' }), txn({ id: '2' })]
    expect(expandSplitChildrenForCategoryView(list).map(t => t.id)).toEqual(['1', '2'])
  })
  it('preserves array order', () => {
    const list = [txn({ id: 'b' }), txn({ id: 'a' }), txn({ id: 'c' })]
    expect(expandSplitChildrenForCategoryView(list).map(t => t.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('expandSplitChildrenForCategoryView (with children)', () => {
  it('replaces parents that have children with their child rows', () => {
    const child1 = txn({ id: 'c1', parentId: 'p', amount: 60 })
    const child2 = txn({ id: 'c2', parentId: 'p', amount: 40 })
    const parent = { ...txn({ id: 'p', amount: 100 }), children: [child1, child2] } as Transaction
    const result = expandSplitChildrenForCategoryView([parent])
    expect(result.map(t => t.id)).toEqual(['c1', 'c2'])
  })
  it('passes through parents that have no children', () => {
    const a = txn({ id: 'a' })
    const b = txn({ id: 'b' })
    expect(expandSplitChildrenForCategoryView([a, b]).map(t => t.id)).toEqual(['a', 'b'])
  })
  it('skips standalone child rows when their parent appears in the input', () => {
    // Avoids double-counting: parent expands to its children, raw child rows are dropped.
    const child1 = txn({ id: 'c1', parentId: 'p' })
    const child2 = txn({ id: 'c2', parentId: 'p' })
    const parent = { ...txn({ id: 'p' }), children: [child1, child2] } as Transaction
    const result = expandSplitChildrenForCategoryView([parent, child1, child2])
    expect(result.map(t => t.id)).toEqual(['c1', 'c2'])
  })
})
