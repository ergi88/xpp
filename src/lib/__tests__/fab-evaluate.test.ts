import { describe, it, expect } from 'vitest'
import { evaluate } from '@/lib/fab-evaluate'

describe('evaluate', () => {
  it('evaluates simple addition', () => {
    expect(evaluate('1 + 2')).toBe('3')
  })

  it('evaluates operator precedence', () => {
    expect(evaluate('120 + 50 * 2')).toBe('220')
  })

  it('evaluates decimals', () => {
    expect(evaluate('1.5 + 2.5')).toBe('4')
  })

  it('evaluates parentheses', () => {
    expect(evaluate('(120 + 50) * 2')).toBe('340')
  })

  it('evaluates percentage as division by 100', () => {
    expect(evaluate('200 * 10 / 100')).toBe('20')
  })

  it('returns — for empty string', () => {
    expect(evaluate('')).toBe('—')
  })

  it('returns — for invalid expression', () => {
    expect(evaluate('abc')).toBe('—')
  })

  it('returns — for division by zero', () => {
    expect(evaluate('1 / 0')).toBe('—')
  })

  it('returns — for incomplete expression', () => {
    expect(evaluate('1 +')).toBe('—')
  })

  it('strips commas before evaluating', () => {
    expect(evaluate('1,000 + 500')).toBe('1500')
  })
})
