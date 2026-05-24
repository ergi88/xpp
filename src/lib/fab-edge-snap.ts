import type React from 'react'

export type Edge = 'left' | 'right' | 'top' | 'bottom'

export interface EdgeSnap {
  edge: Edge
  position: number  // Y for left/right edges; X for top/bottom edges
}

export interface EdgeOffsets {
  top: number     // px from top edge: min Y for left/right snap (below header)
  bottom: number  // px from bottom edge: clearance for left/right snap (above footer)
  side: number    // px from left/right edges: clearance for top/bottom snap
}

export function snapToEdge(
  fabCenterX: number,
  fabCenterY: number,
  screenWidth: number,
  screenHeight: number,
  fabSize: number,
  offsets: EdgeOffsets,
): EdgeSnap {
  const distLeft = fabCenterX
  const distRight = screenWidth - fabCenterX
  const distTop = fabCenterY
  const distBottom = screenHeight - fabCenterY

  const min = Math.min(distLeft, distRight, distTop, distBottom)

  let edge: Edge
  if (min === distLeft) edge = 'left'
  else if (min === distRight) edge = 'right'
  else if (min === distTop) edge = 'top'
  else edge = 'bottom'

  let position: number
  if (edge === 'left' || edge === 'right') {
    const minY = offsets.top
    const maxY = screenHeight - offsets.bottom - fabSize
    position = Math.max(minY, Math.min(maxY, fabCenterY - fabSize / 2))
  } else {
    const minX = offsets.side
    const maxX = screenWidth - offsets.side - fabSize
    position = Math.max(minX, Math.min(maxX, fabCenterX - fabSize / 2))
  }

  return { edge, position }
}

export function getEdgeStyle(
  snap: EdgeSnap,
  _fabSize: number,
  offsets: EdgeOffsets,
): React.CSSProperties {
  const { edge, position } = snap
  switch (edge) {
    case 'left':   return { left: `${offsets.side}px`, top: `${position}px` }
    case 'right':  return { right: `${offsets.side}px`, top: `${position}px` }
    case 'top':    return { top: `${offsets.top}px`, left: `${position}px` }
    case 'bottom': return { bottom: `${offsets.bottom}px`, left: `${position}px` }
  }
}

export function getPanelDirection(snap: EdgeSnap): 'right' | 'left' | 'down' | 'up' {
  switch (snap.edge) {
    case 'left':   return 'right'
    case 'right':  return 'left'
    case 'top':    return 'down'
    case 'bottom': return 'up'
  }
}
