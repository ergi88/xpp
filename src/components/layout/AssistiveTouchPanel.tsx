import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calculator, Copy, Check, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { evaluate } from '@/lib/fab-evaluate'
import { type EdgeSnap, type EdgeOffsets } from '@/lib/fab-edge-snap'
import type { FABAction } from '@/lib/fab-context'

const CELL_SIZE = 72
const PANEL_PAD = 8
const PANEL_SIZE = 3 * CELL_SIZE + 2 * PANEL_PAD  // 232px

const SLOT_MAP: Record<number, number[]> = {
  1: [4],
  2: [3, 5],
  3: [1, 3, 5],
  4: [1, 3, 5, 7],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 5, 7],
  7: [0, 2, 3, 5, 6, 7, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
}

const SUB_SLOT_MAP: Record<number, number[]> = {
  1: [1],
  2: [3, 5],
  3: [1, 3, 5],
  4: [1, 3, 5, 7],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 5, 7],
  7: [0, 2, 3, 5, 6, 7, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
}

export function getSlots(n: number, isSubView: boolean): number[] {
  if (isSubView) {
    const clamped = Math.min(Math.max(n, 1), 8)
    return SUB_SLOT_MAP[clamped]
  }
  const clamped = Math.min(Math.max(n, 1), 9)
  return SLOT_MAP[clamped]
}

function getPanelStyle(
  snap: EdgeSnap,
  fabSize: number,
  offsets: EdgeOffsets,
): React.CSSProperties {
  const GAP = 8
  switch (snap.edge) {
    case 'left':
      return { left: `${offsets.side + fabSize + GAP}px`, top: `${snap.position}px` }
    case 'right':
      return { right: `${offsets.side + fabSize + GAP}px`, top: `${snap.position}px` }
    case 'top':
      return { top: `${offsets.top + fabSize + GAP}px`, left: `${snap.position}px` }
    case 'bottom':
      return { bottom: `${offsets.bottom + fabSize + GAP}px`, left: `${snap.position}px` }
  }
}

function getCalcStyle(
  snap: EdgeSnap,
  fabSize: number,
  offsets: EdgeOffsets,
): React.CSSProperties {
  const GAP = 8
  switch (snap.edge) {
    case 'left':
      return {
        left: `${offsets.side + fabSize + GAP}px`,
        top: `${snap.position + PANEL_SIZE + GAP}px`,
        position: 'fixed',
        zIndex: 50,
      }
    case 'right':
      return {
        right: `${offsets.side + fabSize + GAP}px`,
        top: `${snap.position + PANEL_SIZE + GAP}px`,
        position: 'fixed',
        zIndex: 50,
      }
    case 'top':
      return {
        top: `${offsets.top + fabSize + GAP + PANEL_SIZE + GAP}px`,
        left: `${snap.position}px`,
        position: 'fixed',
        zIndex: 50,
      }
    case 'bottom':
      return {
        bottom: `${offsets.bottom + fabSize + GAP + PANEL_SIZE + GAP}px`,
        left: `${snap.position}px`,
        position: 'fixed',
        zIndex: 50,
      }
  }
}

interface AssistiveTouchPanelProps {
  actions: FABAction[]   // page-registered actions (may be empty)
  snap: EdgeSnap
  fabSize: number
  offsets: EdgeOffsets
  onClose: () => void
}

export function AssistiveTouchPanel({
  actions,
  snap,
  fabSize,
  offsets,
  onClose,
}: AssistiveTouchPanelProps) {
  const [activeParent, setActiveParent] = useState<FABAction | null>(null)
  const [calcOpen, setCalcOpen] = useState(false)
  const [expr, setExpr] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const result = evaluate(expr)

  const calculatorAction: FABAction = {
    id: '__calculator',
    label: 'Calculator',
    icon: Calculator,
    onClick: () => {
      setCalcOpen((v) => !v)
      setTimeout(() => inputRef.current?.focus(), 50)
    },
  }

  function handleCopy() {
    if (result === '—') return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isSubView = Boolean(activeParent)
  const mainActions = [...actions, calculatorAction]
  const currentActions = isSubView ? (activeParent!.children ?? []).slice(0, 8) : mainActions.slice(0, 9)
  const slots = getSlots(currentActions.length, isSubView)

  // Build 9-cell array; empty slots are null
  const cells: React.ReactNode[] = Array(9).fill(null)

  if (isSubView) {
    cells[4] = (
      <motion.button
        key="__back"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.15 }}
        onClick={() => setActiveParent(null)}
        className="flex flex-col items-center justify-center gap-1"
        style={{ width: CELL_SIZE, height: CELL_SIZE }}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-white/20 border border-white/30 text-white">
          <ChevronLeft className="size-5" />
        </div>
        <span className="text-[10px] text-white/80">Back</span>
      </motion.button>
    )
  }

  slots.forEach((slotIdx, animIdx) => {
    const action = currentActions[animIdx]
    if (!action) return
    const hasChildren = Boolean(action.children?.length)
    cells[slotIdx] = (
      <motion.button
        key={action.id}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: (isSubView ? animIdx + 1 : animIdx) * 0.02, duration: 0.15 }}
        onClick={() => {
          if (hasChildren) {
            setActiveParent(action)
          } else {
            action.onClick?.()
            onClose()
          }
        }}
        className="flex flex-col items-center justify-center gap-1"
        style={{ width: CELL_SIZE, height: CELL_SIZE }}
      >
        <div className={cn(
          'flex size-12 items-center justify-center rounded-full border text-white',
          action.id === '__calculator' && calcOpen
            ? 'bg-white/30 border-white/40'
            : 'bg-white/10 border-white/20',
        )}>
          <action.icon className="size-5" />
        </div>
        <span className="max-w-[64px] truncate text-[10px] text-white/80">{action.label}</span>
      </motion.button>
    )
  })

  const panelStyle: React.CSSProperties = {
    ...getPanelStyle(snap, fabSize, offsets),
    position: 'fixed',
    zIndex: 50,
    display: 'grid',
    gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
    padding: PANEL_PAD,
    borderRadius: 20,
    background: 'rgba(28, 28, 30, 0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.12)',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onPointerDown={onClose}
      />

      {/* Calculator popover */}
      <AnimatePresence>
        {calcOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={getCalcStyle(snap, fabSize, offsets)}
            className="w-52 rounded-2xl border bg-popover p-4 shadow-xl"
          >
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Calculator
            </p>
            <input
              ref={inputRef}
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="120 + 50 * 2"
              className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className={cn(
                'font-mono text-lg font-semibold',
                result === '—' ? 'text-muted-foreground' : 'text-primary',
              )}>
                = {result}
              </span>
              <button
                onClick={handleCopy}
                disabled={result === '—'}
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Supports + − × ÷ ( )
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel grid */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={panelStyle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isSubView ? activeParent!.id : '__main'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
            }}
          >
            {cells.map((cell, i) => (
              <div key={i} style={{ width: CELL_SIZE, height: CELL_SIZE }}>
                {cell}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </>
  )
}
