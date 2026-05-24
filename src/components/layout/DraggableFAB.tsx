import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'motion/react'
import { snapToEdge, getEdgeStyle, type EdgeSnap, type EdgeOffsets } from '@/lib/fab-edge-snap'
import { useFABState } from '@/lib/fab-context'
import { AssistiveTouchPanel } from './AssistiveTouchPanel'

const FAB_SIZE = 52
const OFFSETS: EdgeOffsets = {
  top: 72,
  bottom: 100,
  side: 16,
}
const STORAGE_KEY = 'fab-edge-snap'
const DRAG_THRESHOLD = 8
const IDLE_MS = 10_000

function loadSnap(): EdgeSnap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        ['left', 'right', 'top', 'bottom'].includes(parsed.edge) &&
        typeof parsed.position === 'number'
      ) {
        return parsed as EdgeSnap
      }
    }
  } catch { /* ignore */ }
  return { edge: 'right', position: 300 }
}

function saveSnap(snap: EdgeSnap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snap)) } catch { /* ignore */ }
}

export function DraggableFAB() {
  const actions = useFABState()
  const [snap, setSnap] = useState<EdgeSnap>(loadSnap)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [opacity, setOpacity] = useState(1)

  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetIdleTimer = useCallback(() => {
    setOpacity(1)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (!open) {
      idleTimer.current = setTimeout(() => setOpacity(0.35), IDLE_MS)
    }
  }, [open])

  useEffect(() => {
    resetIdleTimer()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [resetIdleTimer])

  const snapStyle = getEdgeStyle(snap, FAB_SIZE, OFFSETS)

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
        ...snapStyle,
        width: FAB_SIZE,
        height: FAB_SIZE,
        zIndex: 50,
        opacity: open ? 0 : opacity,
        pointerEvents: open ? 'none' : 'auto',
        transition: 'opacity 0.6s ease, top 0.2s ease-out, right 0.2s ease-out, bottom 0.2s ease-out, left 0.2s ease-out',
      }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStart.current = { x: e.clientX, y: e.clientY }
    didDrag.current = false
    resetIdleTimer()
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
      const newSnap = snapToEdge(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
        FAB_SIZE,
        OFFSETS,
      )
      setSnap(newSnap)
      saveSnap(newSnap)
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
      <AnimatePresence>
        {open && !dragging && (
          <AssistiveTouchPanel
            actions={actions}
            snap={snap}
            fabSize={FAB_SIZE}
            offsets={OFFSETS}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB — stays mounted when open (opacity:0) to preserve drag target */}
      <button
        style={fabStyle}
        aria-label={open ? 'Close actions' : 'Open actions'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerEnter={resetIdleTimer}
        className="select-none touch-none rounded-full shadow-2xl"
      >
        {/* Concentric rings — Apple AssistiveTouch style */}
        <div
          className="flex size-full items-center justify-center rounded-full"
          style={{ background: '#111' }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 38, height: 38, background: '#2a2a2a' }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 24, height: 24, background: '#888' }}
            >
              <div
                className="rounded-full"
                style={{ width: 14, height: 14, background: 'white' }}
              />
            </div>
          </div>
        </div>
      </button>
    </>
  )
}
