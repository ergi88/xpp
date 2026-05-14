import { describe, it, expect } from 'vitest'
import type { Transaction } from '@/types'
import { findCounterpartCandidates } from '@/lib/counterpart-matcher'

function txn(o: Partial<Transaction> & { id: string }): Transaction {
  return {
    id: o.id,
    type: o.type ?? 'expense',
    amount: o.amount ?? 100,
    date: o.date ?? '2026-05-10',
    account: o.account ?? ({ id: 'a1' } as Transaction['account']),
    items: [],
    tags: [],
    isExcluded: false,
    isOneTime: false,
    parentId: null,
    debtId: null,
    linkedTransactionId: null,
    recurringId: null,
    ...o,
  } as Transaction
}

describe('findCounterpartCandidates', () => {
  it('returns rows of opposite type on different account, same amount, ±7 days', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, date: '2026-05-10', account: { id: 'a1' } as Transaction['account'] })
    const match = txn({ id: 'm', type: 'income', amount: 100, date: '2026-05-11', account: { id: 'a2' } as Transaction['account'] })
    const result = findCounterpartCandidates(source, [source, match])
    expect(result.map(t => t.id)).toEqual(['m'])
  })
  it('excludes same type', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const same = txn({ id: 'x', type: 'expense', amount: 100, account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, same])).toEqual([])
  })
  it('excludes same account', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const sameAcc = txn({ id: 'x', type: 'income', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, sameAcc])).toEqual([])
  })
  it('excludes outside ±7 days', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, date: '2026-05-01', account: { id: 'a1' } as Transaction['account'] })
    const far = txn({ id: 'x', type: 'income', amount: 100, date: '2026-05-20', account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, far])).toEqual([])
  })
  it('excludes amount mismatch outside 0.01', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const off = txn({ id: 'x', type: 'income', amount: 100.5, account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, off])).toEqual([])
  })
  it('excludes already-linked rows', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const linked = txn({ id: 'x', type: 'income', amount: 100, linkedTransactionId: 'other', account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, linked])).toEqual([])
  })
  it('excludes split children', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    const child = txn({ id: 'x', type: 'income', amount: 100, parentId: 'p', account: { id: 'a2' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source, child])).toEqual([])
  })
  it('excludes the source itself', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, account: { id: 'a1' } as Transaction['account'] })
    expect(findCounterpartCandidates(source, [source])).toEqual([])
  })
  it('returns multiple candidates sorted by closest date', () => {
    const source = txn({ id: 's', type: 'expense', amount: 100, date: '2026-05-10', account: { id: 'a1' } as Transaction['account'] })
    const day3 = txn({ id: 'm3', type: 'income', amount: 100, date: '2026-05-13', account: { id: 'a2' } as Transaction['account'] })
    const day1 = txn({ id: 'm1', type: 'income', amount: 100, date: '2026-05-11', account: { id: 'a2' } as Transaction['account'] })
    const result = findCounterpartCandidates(source, [source, day3, day1])
    expect(result.map(t => t.id)).toEqual(['m1', 'm3'])
  })
})
