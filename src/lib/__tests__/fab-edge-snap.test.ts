import { describe, it, expect } from 'vitest'
import { snapToEdge, getEdgeStyle, getPanelDirection } from '@/lib/fab-edge-snap'
import type { EdgeOffsets } from '@/lib/fab-edge-snap'

const W = 390, H = 844, FAB = 52
const offsets: EdgeOffsets = { top: 72, bottom: 100, side: 16 }

describe('snapToEdge', () => {
  it('snaps to left edge when FAB is far left', () => {
    const snap = snapToEdge(30, 400, W, H, FAB, offsets)
    expect(snap.edge).toBe('left')
  })

  it('snaps to right edge when FAB is far right', () => {
    const snap = snapToEdge(370, 400, W, H, FAB, offsets)
    expect(snap.edge).toBe('right')
  })

  it('snaps to top edge when FAB is near top', () => {
    const snap = snapToEdge(195, 40, W, H, FAB, offsets)
    expect(snap.edge).toBe('top')
  })

  it('snaps to bottom edge when FAB is near bottom', () => {
    const snap = snapToEdge(195, 820, W, H, FAB, offsets)
    expect(snap.edge).toBe('bottom')
  })

  it('left/right edge: position is Y, clamped to top offset minimum', () => {
    // FAB center Y=20 is above offsets.top=72, so position should clamp to 72
    const snap = snapToEdge(10, 20, W, H, FAB, offsets)
    expect(snap.edge).toBe('left')
    expect(snap.position).toBe(offsets.top)
  })

  it('left/right edge: position is Y, clamped to bottom offset maximum', () => {
    const maxY = H - offsets.bottom - FAB
    const snap = snapToEdge(10, H - 10, W, H, FAB, offsets)
    expect(snap.position).toBeLessThanOrEqual(maxY)
  })

  it('top/bottom edge: position is X, clamped to side offset minimum', () => {
    const snap = snapToEdge(5, 5, W, H, FAB, offsets)
    if (snap.edge === 'top' || snap.edge === 'bottom') {
      expect(snap.position).toBeGreaterThanOrEqual(offsets.side)
    }
  })

  it('top/bottom edge: position is X, clamped to side offset maximum', () => {
    const maxX = W - offsets.side - FAB
    const snap = snapToEdge(W - 5, 5, W, H, FAB, offsets)
    if (snap.edge === 'top' || snap.edge === 'bottom') {
      expect(snap.position).toBeLessThanOrEqual(maxX)
    }
  })
})

describe('getEdgeStyle', () => {
  it('left edge: left=side, top=position', () => {
    expect(getEdgeStyle({ edge: 'left', position: 200 }, FAB, offsets))
      .toEqual({ left: '16px', top: '200px' })
  })

  it('right edge: right=side, top=position', () => {
    expect(getEdgeStyle({ edge: 'right', position: 200 }, FAB, offsets))
      .toEqual({ right: '16px', top: '200px' })
  })

  it('top edge: top=offsets.top, left=position', () => {
    expect(getEdgeStyle({ edge: 'top', position: 100 }, FAB, offsets))
      .toEqual({ top: '72px', left: '100px' })
  })

  it('bottom edge: bottom=offsets.bottom, left=position', () => {
    expect(getEdgeStyle({ edge: 'bottom', position: 100 }, FAB, offsets))
      .toEqual({ bottom: '100px', left: '100px' })
  })
})

describe('getPanelDirection', () => {
  it('left edge → panel opens right', () => {
    expect(getPanelDirection({ edge: 'left', position: 0 })).toBe('right')
  })
  it('right edge → panel opens left', () => {
    expect(getPanelDirection({ edge: 'right', position: 0 })).toBe('left')
  })
  it('top edge → panel opens down', () => {
    expect(getPanelDirection({ edge: 'top', position: 0 })).toBe('down')
  })
  it('bottom edge → panel opens up', () => {
    expect(getPanelDirection({ edge: 'bottom', position: 0 })).toBe('up')
  })
})
