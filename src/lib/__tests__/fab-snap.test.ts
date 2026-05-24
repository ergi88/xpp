import { describe, it, expect } from 'vitest'
import { snapToCorner, getCornerStyle, isRightCorner, isBottomCorner } from '@/lib/fab-snap'

describe('snapToCorner', () => {
  const W = 390, H = 844

  it('top-left quadrant → top-left', () => {
    expect(snapToCorner(50, 100, W, H)).toBe('top-left')
  })

  it('top-right quadrant → top-right', () => {
    expect(snapToCorner(350, 100, W, H)).toBe('top-right')
  })

  it('bottom-left quadrant → bottom-left', () => {
    expect(snapToCorner(50, 700, W, H)).toBe('bottom-left')
  })

  it('bottom-right quadrant → bottom-right', () => {
    expect(snapToCorner(350, 700, W, H)).toBe('bottom-right')
  })

  it('exact center-left → bottom-left (tie goes to bottom)', () => {
    expect(snapToCorner(50, H / 2, W, H)).toBe('bottom-left')
  })
})

describe('getCornerStyle', () => {
  const offsets = { top: 72, bottom: 100, side: 16 }

  it('top-left', () => {
    expect(getCornerStyle('top-left', offsets)).toEqual({ top: '72px', left: '16px' })
  })

  it('top-right', () => {
    expect(getCornerStyle('top-right', offsets)).toEqual({ top: '72px', right: '16px' })
  })

  it('bottom-left', () => {
    expect(getCornerStyle('bottom-left', offsets)).toEqual({ bottom: '100px', left: '16px' })
  })

  it('bottom-right', () => {
    expect(getCornerStyle('bottom-right', offsets)).toEqual({ bottom: '100px', right: '16px' })
  })
})

describe('isRightCorner', () => {
  it('returns true for right corners', () => {
    expect(isRightCorner('top-right')).toBe(true)
    expect(isRightCorner('bottom-right')).toBe(true)
  })
  it('returns false for left corners', () => {
    expect(isRightCorner('top-left')).toBe(false)
    expect(isRightCorner('bottom-left')).toBe(false)
  })
})

describe('isBottomCorner', () => {
  it('returns true for bottom corners', () => {
    expect(isBottomCorner('bottom-left')).toBe(true)
    expect(isBottomCorner('bottom-right')).toBe(true)
  })
  it('returns false for top corners', () => {
    expect(isBottomCorner('top-left')).toBe(false)
    expect(isBottomCorner('top-right')).toBe(false)
  })
})
