import { describe, it, expect } from 'vitest'
import { toBool, toIdOrNull } from '@/lib/coerce'

describe('toBool', () => {
  it('returns true for true, "true", "TRUE", 1, "1"', () => {
    expect(toBool(true)).toBe(true)
    expect(toBool('true')).toBe(true)
    expect(toBool('TRUE')).toBe(true)
    expect(toBool(1)).toBe(true)
    expect(toBool('1')).toBe(true)
  })
  it('returns false for false, "false", "FALSE", 0, "0", "", undefined, null', () => {
    expect(toBool(false)).toBe(false)
    expect(toBool('false')).toBe(false)
    expect(toBool('FALSE')).toBe(false)
    expect(toBool(0)).toBe(false)
    expect(toBool('0')).toBe(false)
    expect(toBool('')).toBe(false)
    expect(toBool(undefined)).toBe(false)
    expect(toBool(null)).toBe(false)
  })
})

describe('toIdOrNull', () => {
  it('returns null for empty/missing values', () => {
    expect(toIdOrNull('')).toBeNull()
    expect(toIdOrNull(undefined)).toBeNull()
    expect(toIdOrNull(null)).toBeNull()
  })
  it('returns string id for non-empty values', () => {
    expect(toIdOrNull('abc')).toBe('abc')
    expect(toIdOrNull(123)).toBe('123')
  })
})
