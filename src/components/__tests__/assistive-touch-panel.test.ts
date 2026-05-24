import { describe, it, expect } from 'vitest'
import { getSlots } from '@/components/layout/AssistiveTouchPanel'

describe('getSlots — main view', () => {
  it('n=1 → center [4]', () => expect(getSlots(1, false)).toEqual([4]))
  it('n=2 → [3,5]', () => expect(getSlots(2, false)).toEqual([3, 5]))
  it('n=3 → [1,3,5]', () => expect(getSlots(3, false)).toEqual([1, 3, 5]))
  it('n=4 → [1,3,5,7]', () => expect(getSlots(4, false)).toEqual([1, 3, 5, 7]))
  it('n=5 → [0,1,2,3,5]', () => expect(getSlots(5, false)).toEqual([0, 1, 2, 3, 5]))
  it('n=6 → [0,1,2,3,5,7]', () => expect(getSlots(6, false)).toEqual([0, 1, 2, 3, 5, 7]))
  it('n=7 → [0,2,3,5,6,7,8]', () => expect(getSlots(7, false)).toEqual([0, 2, 3, 5, 6, 7, 8]))
  it('n=8 → [0,1,2,3,5,6,7,8]', () => expect(getSlots(8, false)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]))
  it('n=9 → all slots', () => expect(getSlots(9, false)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]))
  it('n>9 → capped at 9 slots', () => expect(getSlots(12, false)).toHaveLength(9))
})

describe('getSlots — sub view', () => {
  it('n=1 → [1] (top-middle, not slot 4)', () => expect(getSlots(1, true)).toEqual([1]))
  it('n=2 → [3,5]', () => expect(getSlots(2, true)).toEqual([3, 5]))
  it('n=3 → [1,3,5]', () => expect(getSlots(3, true)).toEqual([1, 3, 5]))
  it('n=8 → max 8 slots, excludes slot 4', () => {
    const slots = getSlots(8, true)
    expect(slots).toHaveLength(8)
    expect(slots).not.toContain(4)
  })
  it('n>8 → capped at 8', () => expect(getSlots(10, true)).toHaveLength(8))
  it('never includes slot 4 for any n', () => {
    for (let n = 1; n <= 8; n++) {
      expect(getSlots(n, true)).not.toContain(4)
    }
  })
})
