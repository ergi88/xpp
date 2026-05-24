// src/components/layout/DraggableFAB.tsx
import { useState, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import { Zap, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { snapToCorner, getCornerStyle, type Corner, type CornerOffsets } from '@/lib/fab-snap'
import { useFABState } from '@/lib/fab-context'
import { SpeedDial } from './SpeedDial'

const FAB_SIZE = 52
const OFFSETS: CornerOffsets = {
  top: 56 + 16,    // header h-14 (56px) + 16px gap
  bottom: 84 + 16, // footer sheet (~84px) + 16px gap
  side: 16,
}
const STORAGE_KEY = 'fab-corner'
const DRAG_THRESHOLD = 8

function loadCorner(): Corner {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'top-left' || v === 'top-right' || v === 'bottom-left' || v === 'bottom-right') {
      return v
    }
  } catch { /* ignore */ }
  return 'bottom-right'
}

function saveCorner(corner: Corner) {
  try { localStorage.setItem(STORAGE_KEY, corner) } catch { /* ignore */ }
}

export function DraggableFAB() {
  const actions = useFABState()
  const [corner, setCorner] = useState<Corner>(loadCorner)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)

  const cornerStyle = getCornerStyle(corner, OFFSETS)

  // Merged FAB style: position changes during drag vs rest
  const fabStyle: React.CSSProperties = dragPos
    ? {
        position: 'fixed',
        left: dragPos.x,
        top: dragPos.y,
        width: FAB_SIZE,
        height: FAB_SIZE,
        zIndex: 50,
      }
    : {
        position: 'fixed',
        ...cornerStyle,
        width: FAB_SIZE,
        height: FAB_SIZE,
        zIndex: 50,
        transition: 'top 0.2s ease-out, right 0.2s ease-out, bottom 0.2s ease-out, left 0.2s ease-out',
      }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStart.current = { x: e.clientX, y: e.clientY }
    didDrag.current = false
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerStart.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (!didDrag.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      didDrag.current = true
      setDragging(true)
      if (open) setOpen(false)
    }
    if (didDrag.current) {
      setDragPos({ x: e.clientX - FAB_SIZE / 2, y: e.clientY - FAB_SIZE / 2 })
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointerStart.current = null
    setDragging(false)
    setDragPos(null)

    if (didDrag.current) {
      const newCorner = snapToCorner(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
      )
      setCorner(newCorner)
      saveCorner(newCorner)
    } else {
      setOpen((v) => !v)
    }
    didDrag.current = false
  }

  function handlePointerCancel() {
    pointerStart.current = null
    setDragging(false)
    setDragPos(null)
    didDrag.current = false
  }

  return (
    <>
      {/* Speed dial — mounts/unmounts with open state, self-positions via fixed CSS */}
      <AnimatePresence>
        {open && !dragging && (
          <SpeedDial
            actions={actions}
            corner={corner}
            fabSize={FAB_SIZE}
            offsets={OFFSETS}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB button — single style prop, no duplicate */}
      <button
        style={fabStyle}
        aria-label={open ? 'Close actions' : 'Open actions'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={cn(
          'flex items-center justify-center rounded-full bg-primary text-primary-foreground',
          'shadow-lg transition-colors select-none touch-none',
          dragging && 'shadow-2xl cursor-grabbing',
        )}
      >
        {open ? <X className="size-5" /> : <Zap className="size-5" />}
      </button>
    </>
  )
}
