import { describe, it, expect } from 'vitest'
import { getCategoryIconComponent } from '@/lib/category-icon'
import { Tag, ShoppingCart } from 'lucide-react'

describe('getCategoryIconComponent', () => {
  it('returns ShoppingCart for "ShoppingCart"', () => {
    expect(getCategoryIconComponent('ShoppingCart')).toBe(ShoppingCart)
  })
  it('returns Tag for unknown/emoji values', () => {
    expect(getCategoryIconComponent('🏠')).toBe(Tag)
    expect(getCategoryIconComponent('NotAReal')).toBe(Tag)
    expect(getCategoryIconComponent('')).toBe(Tag)
  })
})
