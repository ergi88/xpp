import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  resolveEntity,
  parseIntentAmount,
  parseIntentDate,
  parseTransactionIntent,
  type IntentContext,
  type TypedEntity,
} from '@/lib/transaction-intent'

const accounts = [
  { id: 'acc-1', name: 'Revolut' },
  { id: 'acc-2', name: 'Cash Wallet' },
  { id: 'acc-3', name: 'Cash Savings' },
]

const categories: TypedEntity[] = [
  { id: 'cat-1', name: 'Food & Drinks', type: 'expense' },
  { id: 'cat-2', name: 'Transport', type: 'expense' },
  { id: 'cat-3', name: 'Salary', type: 'income' },
]

const tags = [
  { id: 'tag-1', name: 'work' },
  { id: 'tag-2', name: 'reimbursable' },
]

const NOW = new Date(2026, 7, 31) // 2026-08-31, local
const ctx: IntentContext = { accounts, categories, tags, now: NOW }

describe('normalizeName', () => {
  it('folds case, accents and punctuation', () => {
    expect(normalizeName('Food & Drinks')).toBe('fooddrinks')
    expect(normalizeName('Café')).toBe('cafe')
  })
})

describe('resolveEntity', () => {
  it('matches by id first', () => {
    expect(resolveEntity('acc-1', accounts)).toEqual({ status: 'ok', item: accounts[0] })
  })
  it('matches by name, case-insensitively', () => {
    expect(resolveEntity('revolut', accounts)).toEqual({ status: 'ok', item: accounts[0] })
  })
  it('matches by unique substring', () => {
    expect(resolveEntity('food', categories)).toEqual({ status: 'ok', item: categories[0] })
  })
  it('reports ambiguity instead of guessing', () => {
    const found = resolveEntity('cash', accounts)
    expect(found.status).toBe('ambiguous')
  })
  it('reports misses', () => {
    expect(resolveEntity('nope', accounts)).toEqual({ status: 'not_found' })
  })
})

describe('parseIntentAmount', () => {
  it.each([
    ['222', 222],
    ['12.50', 12.5],
    ['€1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1,50', 1.5],
    ['1,500', 1500],
    ['-40', -40],
    ['  9 ', 9],
  ])('parses %s', (raw, expected) => {
    expect(parseIntentAmount(raw as string)).toBe(expected)
  })
  it('returns null for junk', () => {
    expect(parseIntentAmount('abc')).toBeNull()
    expect(parseIntentAmount('')).toBeNull()
  })
})

describe('parseIntentDate', () => {
  it('passes ISO dates through', () => {
    expect(parseIntentDate('2026-05-02')).toBe('2026-05-02')
  })
  it('reads slash dates day-first by default', () => {
    expect(parseIntentDate('02/05/2026')).toBe('2026-05-02')
  })
  it('honours an explicit month-first order', () => {
    expect(parseIntentDate('02/05/2026', { order: 'mdy' })).toBe('2026-02-05')
  })
  it('swaps when only one reading is possible', () => {
    expect(parseIntentDate('25/12/2026', { order: 'mdy' })).toBe('2026-12-25')
  })
  it('accepts dots, dashes and two-digit years', () => {
    expect(parseIntentDate('2.5.26')).toBe('2026-05-02')
    expect(parseIntentDate('02-05-2026')).toBe('2026-05-02')
  })
  it('accepts a leading four-digit year with slashes', () => {
    expect(parseIntentDate('2026/05/02')).toBe('2026-05-02')
  })
  it('resolves relative words against the injected clock', () => {
    expect(parseIntentDate('today', { now: NOW })).toBe('2026-08-31')
    expect(parseIntentDate('yesterday', { now: NOW })).toBe('2026-08-30')
    expect(parseIntentDate('-3d', { now: NOW })).toBe('2026-08-28')
  })
  it('rejects impossible dates', () => {
    expect(parseIntentDate('32/01/2026')).toBeNull()
    expect(parseIntentDate('2026-02-30')).toBeNull()
    expect(parseIntentDate('not a date')).toBeNull()
  })
})

describe('parseTransactionIntent', () => {
  it('fills the form from a shortcut-style URL', () => {
    const intent = parseTransactionIntent(
      { amount: '222', description: 'storeName', date: '02/05/2026', category: 'food', account: 'Revolut' },
      ctx,
    )
    expect(intent.hasIntent).toBe(true)
    expect(intent.problems).toEqual([])
    expect(intent.values).toEqual({
      type: 'expense',
      amount: 222,
      description: 'storeName',
      date: '2026-05-02',
      account_id: 'acc-1',
      category_id: 'cat-1',
    })
  })

  it('reports no intent for a bare form URL', () => {
    const intent = parseTransactionIntent({}, ctx)
    expect(intent.hasIntent).toBe(false)
    expect(intent.values).toEqual({ type: 'expense' })
  })

  it('adopts the category type when type is not given', () => {
    const intent = parseTransactionIntent({ amount: '3000', category: 'salary' }, ctx)
    expect(intent.values.type).toBe('income')
    expect(intent.values.category_id).toBe('cat-3')
  })

  it('keeps an explicit type and flags a mismatched category', () => {
    const intent = parseTransactionIntent({ type: 'expense', category: 'salary' }, ctx)
    expect(intent.values.type).toBe('expense')
    expect(intent.values.category_id).toBeUndefined()
    expect(intent.problems).toContain('No expense category named "salary"')
  })

  it('accepts type aliases and drops the sign from negative amounts', () => {
    const intent = parseTransactionIntent({ type: 'out', amount: '-40' }, ctx)
    expect(intent.values.type).toBe('expense')
    expect(intent.values.amount).toBe(40)
  })

  it('resolves tags by name and reports unknown ones', () => {
    const intent = parseTransactionIntent({ tags: 'work,missing' }, ctx)
    expect(intent.values.tag_ids).toEqual(['tag-1'])
    expect(intent.problems).toContain('No tag named "missing"')
  })

  it('falls back to the only account when one exists', () => {
    const single: IntentContext = { ...ctx, accounts: [accounts[0]] }
    const intent = parseTransactionIntent({ amount: '10' }, single)
    expect(intent.values.account_id).toBe('acc-1')
  })

  it('does not preselect an account without an intent', () => {
    const single: IntentContext = { ...ctx, accounts: [accounts[0]] }
    expect(parseTransactionIntent({}, single).values.account_id).toBeUndefined()
  })

  it('auto-submits only when everything resolved', () => {
    const good = parseTransactionIntent(
      { amount: '222', category: 'food', account: 'Revolut', submit: '1' },
      ctx,
    )
    expect(good.autoSubmit).toBe(true)

    const missingCategory = parseTransactionIntent(
      { amount: '222', account: 'Revolut', submit: '1' },
      ctx,
    )
    expect(missingCategory.submitRequested).toBe(true)
    expect(missingCategory.autoSubmit).toBe(false)
    expect(missingCategory.problems).toContain('Category is required to save from a link')

    const ambiguousAccount = parseTransactionIntent(
      { amount: '222', category: 'food', account: 'cash', submit: 'true' },
      ctx,
    )
    expect(ambiguousAccount.autoSubmit).toBe(false)
  })

  it('handles transfers', () => {
    const intent = parseTransactionIntent(
      { type: 'transfer', amount: '50', account: 'Revolut', to_account: 'Cash Wallet', submit: '1' },
      ctx,
    )
    expect(intent.autoSubmit).toBe(true)
    expect(intent.values).toMatchObject({
      type: 'transfer',
      to_account_id: 'acc-2',
      account_id: 'acc-1',
    })
  })

  it('rejects a category on a transfer', () => {
    const intent = parseTransactionIntent({ type: 'transfer', category: 'food' }, ctx)
    expect(intent.problems).toContain('Transfers cannot have a category')
  })

  it('still accepts explicit ids', () => {
    const intent = parseTransactionIntent(
      { account_id: 'acc-2', category_id: 'cat-2', tag_ids: 'tag-1,tag-2' },
      ctx,
    )
    expect(intent.values).toMatchObject({
      account_id: 'acc-2',
      category_id: 'cat-2',
      tag_ids: ['tag-1', 'tag-2'],
    })
    expect(intent.problems).toEqual([])
  })
})
