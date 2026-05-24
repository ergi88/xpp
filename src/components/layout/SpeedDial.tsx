// src/components/layout/SpeedDial.tsx
import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calculator, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { evaluate } from '@/lib/fab-evaluate'
import { isRightCorner, isBottomCorner, type Corner, type CornerOffsets } from '@/lib/fab-snap'
import type { FABAction } from '@/lib/fab-context'

interface SpeedDialProps {
  actions: FABAction[]   // page-registered, may be empty
  corner: Corner
  fabSize: number
  offsets: CornerOffsets
  onClose: () => void
}

export function SpeedDial({ actions, corner, fabSize, offsets, onClose }: SpeedDialProps) {
  const [calcOpen, setCalcOpen] = useState(false)
  const [expr, setExpr] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const result = evaluate(expr)
  const onRight = isRightCorner(corner)
  const onBottom = isBottomCorner(corner)
  const hasPageActions = actions.length > 0
  const slideFrom = onBottom ? 20 : -20  // items slide in from FAB direction

  // Stack position: adjacent to FAB, expanding toward screen center
  const stackStyle: React.CSSProperties = {
    position: 'fixed',
    ...(onRight ? { right: offsets.side } : { left: offsets.side }),
    ...(onBottom
      ? { bottom: offsets.bottom + fabSize + 12 }
      : { top: offsets.top + fabSize + 12 }),
    display: 'flex',
    flexDirection: 'column-reverse',
    alignItems: onRight ? 'flex-end' : 'flex-start',
    gap: 10,
    zIndex: 50,
  }

  // Calculator popover: anchored above/below the stack
  const calcStyle: React.CSSProperties = {
    position: 'fixed',
    ...(onRight ? { right: offsets.side } : { left: offsets.side }),
    ...(onBottom
      ? { bottom: offsets.bottom + fabSize + 12 + (hasPageActions ? actions.length * 52 + 32 : 52) + 16 }
      : { top: offsets.top + fabSize + 12 + (hasPageActions ? actions.length * 52 + 32 : 52) + 16 }),
    zIndex: 50,
  }

  function handleCopy() {
    if (result === '—') return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleCalcToggle() {
    setCalcOpen((v) => !v)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Item index for stagger delay — calculator is closest to FAB (index 0 in visual order)
  // In DOM order for flex-col-reverse: [page actions..., divider, calculator]
  // index 0 = calculator (rendered last in DOM, visually first/closest)
  const calcIndex = 0
  const dividerIndex = hasPageActions ? 1 : -1
  const actionStartIndex = hasPageActions ? 2 : -1

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/35"
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
            style={calcStyle}
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

      {/* Speed dial stack — flex-col-reverse makes calculator visually closest to FAB */}
      <div style={stackStyle}>
        {/* Page actions (rendered first in DOM = visually furthest from FAB) */}
        {actions.map((action, i) => (
          <ActionButton
            key={action.id}
            label={action.label}
            icon={<action.icon className="size-4" />}
            onRight={onRight}
            slideFrom={slideFrom}
            index={actionStartIndex + i}
            onClick={() => { action.onClick(); onClose() }}
          />
        ))}

        {/* Divider between page actions and static actions */}
        {hasPageActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: dividerIndex * 0.03 }}
            className={cn('h-px w-16 bg-border', onRight ? 'self-end' : 'self-start')}
          />
        )}

        {/* Calculator — rendered last in DOM = visually closest to FAB (flex-col-reverse) */}
        <ActionButton
          label="Calculator"
          icon={<Calculator className="size-4" />}
          onRight={onRight}
          slideFrom={slideFrom}
          index={calcIndex}
          onClick={handleCalcToggle}
          active={calcOpen}
        />
      </div>
    </>
  )
}

interface ActionButtonProps {
  label: string
  icon: React.ReactNode
  onRight: boolean
  slideFrom: number
  index: number
  onClick: () => void
  active?: boolean
}

function ActionButton({ label, icon, onRight, slideFrom, index, onClick, active }: ActionButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: slideFrom }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: slideFrom }}
      transition={{ delay: index * 0.03, duration: 0.18 }}
      className={cn('flex items-center gap-2', onRight ? 'flex-row-reverse' : 'flex-row')}
    >
      <span className="rounded-full border bg-popover/90 px-3 py-1 text-xs text-foreground shadow-sm backdrop-blur-sm">
        {label}
      </span>
      <button
        onClick={onClick}
        className={cn(
          'flex size-10 items-center justify-center rounded-full border shadow-md transition-colors',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-popover text-foreground hover:bg-accent',
        )}
      >
        {icon}
      </button>
    </motion.div>
  )
}
