export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface CornerOffsets {
  top: number     // px from top of screen (header height + gap)
  bottom: number  // px from bottom of screen (footer height + gap)
  side: number    // px from left/right edges
}

export function snapToCorner(
  fabCenterX: number,
  fabCenterY: number,
  screenWidth: number,
  screenHeight: number,
): Corner {
  const isLeft = fabCenterX < screenWidth / 2
  const isTop = fabCenterY < screenHeight / 2
  return `${isTop ? 'top' : 'bottom'}-${isLeft ? 'left' : 'right'}` as Corner
}

export function getCornerStyle(
  corner: Corner,
  offsets: CornerOffsets,
): { top?: string; bottom?: string; left?: string; right?: string } {
  const { top, bottom, side } = offsets
  switch (corner) {
    case 'top-left':     return { top: `${top}px`, left: `${side}px` }
    case 'top-right':    return { top: `${top}px`, right: `${side}px` }
    case 'bottom-left':  return { bottom: `${bottom}px`, left: `${side}px` }
    case 'bottom-right': return { bottom: `${bottom}px`, right: `${side}px` }
  }
}

export function isRightCorner(corner: Corner): boolean {
  return corner === 'top-right' || corner === 'bottom-right'
}

export function isBottomCorner(corner: Corner): boolean {
  return corner === 'bottom-left' || corner === 'bottom-right'
}
