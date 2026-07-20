import { describe, it, expect } from 'vitest'
import type { Account } from '@/types/accounts'
import type { Category } from '@/types/categories'
import type { Tag } from '@/types/tags'
import type { Currency } from '../types'
import {
  parseAmount,
  tokenizeComment,
  buildDrafts,
  defaultAccount,
  markLine,
  isLineCreated,
  type ParseContext,
} from './transactionParser'

function account(over: Partial<Account> & { id: string; name: string }): Account {
  return {
    type: 'bank',
    currencyId: 'usd',
    initialBalance: 0,
    currentBalance: 100,
    isActive: true,
    ...over,
  } as Account
}

function category(
  over: Partial<Category> & { id: string; name: string; type: 'income' | 'expense' },
): Category {
  return { icon: '', color: '', ...over } as Category
}

function tag(id: string, name: string): Tag {
  return { id, name } as Tag
}

const currencies: Currency[] = [{ id: 'usd', code: 'USD', symbol: '$', rate: 1 }]

const ctx = (): ParseContext => ({
  accounts: [
    account({ id: 'cash', name: 'Cash', currentBalance: 500 }),
    account({ id: 'savings', name: 'Savings', currentBalance: 1000 }),
    account({ id: 'empty', name: 'Empty', currentBalance: 0 }),
  ],
  categories: [
    category({ id: 'food', name: 'Food', type: 'expense', transactionsCount: 10 }),
    category({ id: 'snacks', name: 'Snacks', type: 'expense', transactionsCount: 2 }),
    category({ id: 'salary', name: 'Salary', type: 'income', transactionsCount: 5 }),
  ],
  tags: [tag('work', 'Work'), tag('fun', 'Fun')],
  currencies,
})

describe('parseAmount', () => {
  it('evaluates signed numbers', () => {
    expect(parseAmount('-3000 //food')).toBe(-3000)
    expect(parseAmount('5000 //salary')).toBe(5000)
  })
  it('supports calculator syntax', () => {
    expect(parseAmount('2k + 500')).toBe(2500)
    expect(parseAmount('10 * 5')).toBe(50)
  })
  it('returns null for headers / prose / empty', () => {
    expect(parseAmount('# Groceries')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount('// just a note')).toBeNull()
  })
})

describe('tokenizeComment', () => {
  it('buckets prefixed tokens', () => {
    const t = tokenizeComment('food #work @cash')
    expect(t.categoryText).toBe('food')
    expect(t.tagWords).toEqual(['work'])
    expect(t.accountWord).toBe('cash')
  })
  it('captures transfer destination via >', () => {
    expect(tokenizeComment('rent > Savings').transferWord).toBe('Savings')
    expect(tokenizeComment('rent >Savings').transferWord).toBe('Savings')
  })
  it('treats trailing bare words after a prefix as description', () => {
    const t = tokenizeComment('snacks #fun lunch with team')
    expect(t.categoryText).toBe('snacks')
    expect(t.tagWords).toEqual(['fun'])
    expect(t.description).toBe('lunch with team')
  })
})

describe('defaultAccount', () => {
  it('picks the first active non-debt positive-balance account', () => {
    expect(defaultAccount(ctx().accounts)?.id).toBe('cash')
  })
})

describe('buildDrafts', () => {
  it('maps sign to type and resolves tokens', () => {
    const [d] = buildDrafts('-3000 //food #work @cash', ctx())
    expect(d.type).toBe('expense')
    expect(d.amount).toBe(3000)
    expect(d.categoryId).toBe('food')
    expect(d.tagIds).toEqual(['work'])
    expect(d.accountId).toBe('cash')
    expect(d.unresolved).toEqual({})
  })

  it('positive amount is income', () => {
    const [d] = buildDrafts('5000 //salary', ctx())
    expect(d.type).toBe('income')
    expect(d.categoryId).toBe('salary')
  })

  it('> makes it a transfer with no category', () => {
    const [d] = buildDrafts('-2000 //rent > Savings', ctx())
    expect(d.type).toBe('transfer')
    expect(d.toAccountId).toBe('savings')
    expect(d.categoryId).toBeNull()
  })

  it('defaults category to most-used of the derived type on a miss', () => {
    const [d] = buildDrafts('-100 //nonexistent', ctx())
    expect(d.categoryId).toBe('food') // highest transactionsCount expense
    expect(d.unresolved.category).toBe('nonexistent')
  })

  it('defaults the source account when no @token', () => {
    const [d] = buildDrafts('-100 //food', ctx())
    expect(d.accountId).toBe('cash')
  })

  it('records unresolved tags', () => {
    const [d] = buildDrafts('-100 //food #missing', ctx())
    expect(d.tagIds).toEqual([])
    expect(d.unresolved.tags).toEqual(['missing'])
  })

  it('flags created lines and keeps them parseable + amount intact', () => {
    const withComment = markLine('-3000 //food');
    expect(withComment).toBe('-3000 //food ✓');
    const noComment = markLine('5000');
    expect(noComment).toBe('5000 //✓');

    const drafts = buildDrafts(`${withComment}\n${noComment}`, ctx());
    expect(drafts).toHaveLength(2);
    expect(drafts[0].created).toBe(true);
    expect(drafts[0].amount).toBe(3000);
    expect(drafts[0].categoryId).toBe('food');
    expect(drafts[0].description).toBe(''); // ✓ must not leak into description
    expect(drafts[1].created).toBe(true);
    expect(drafts[1].amount).toBe(5000);
  });

  it('markLine is idempotent and detectable', () => {
    const once = markLine('-300 //snacks');
    expect(markLine(once)).toBe(once);
    expect(isLineCreated(once)).toBe(true);
    expect(isLineCreated('-300 //snacks')).toBe(false);
  });

  it('skips non-amount lines and preserves line indices', () => {
    const text = '# Title\n-3000 //food\n\n5000 //salary'
    const drafts = buildDrafts(text, ctx())
    expect(drafts).toHaveLength(2)
    expect(drafts[0].lineIndex).toBe(1)
    expect(drafts[1].lineIndex).toBe(3)
  })
})
