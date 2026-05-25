import type React from "react";
import { useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, Copy, Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluate } from "@/lib/fab-evaluate";
import { type EdgeSnap, type EdgeOffsets } from "@/lib/fab-edge-snap";
import type { FABAction } from "@/lib/fab-context";

const CELL_SIZE = 72;
const PANEL_PAD = 8;
const PANEL_SIZE = 3 * CELL_SIZE + 2 * PANEL_PAD; // 232px

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
};

const SUB_SLOT_MAP: Record<number, number[]> = {
  1: [1],
  2: [3, 5],
  3: [1, 3, 5],
  4: [1, 3, 5, 7],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 5, 7],
  7: [0, 2, 3, 5, 6, 7, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
};

export function getSlots(n: number, isSubView: boolean): number[] {
  if (isSubView) {
    const clamped = Math.min(Math.max(n, 1), 8);
    return SUB_SLOT_MAP[clamped];
  }
  const clamped = Math.min(Math.max(n, 1), 9);
  return SLOT_MAP[clamped];
}

function getPanelStyle(
  snap: EdgeSnap,
  fabSize: number,
  offsets: EdgeOffsets,
): React.CSSProperties {
  const GAP = 8;
  switch (snap.edge) {
    case "left":
      return {
        left: `${offsets.side + fabSize + GAP}px`,
        top: `${snap.position}px`,
      };
    case "right":
      return {
        right: `${offsets.side + fabSize + GAP}px`,
        top: `${snap.position}px`,
      };
    case "top":
      return {
        top: `${offsets.top + fabSize + GAP}px`,
        left: `${snap.position}px`,
      };
    case "bottom":
      return {
        bottom: `${offsets.bottom + fabSize + GAP}px`,
        left: `${snap.position}px`,
      };
  }
}

interface AssistiveTouchPanelProps {
  actions: FABAction[];
  snap: EdgeSnap;
  fabSize: number;
  offsets: EdgeOffsets;
  onClose: () => void;
}

export function AssistiveTouchPanel({
  actions,
  snap,
  fabSize,
  offsets,
  onClose,
}: AssistiveTouchPanelProps) {
  const [activeParent, setActiveParent] = useState<FABAction | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = evaluate(expr);

  const calculatorAction: FABAction = {
    id: "__calculator",
    label: "Calculator",
    icon: Calculator,
    onClick: () => {
      setCalcOpen(true);
      setTimeout(() => inputRef.current?.focus(), 150);
    },
  };

  function handleCopy() {
    if (result === "—") return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const isSubView = Boolean(activeParent);
  const mainActions = [...actions, calculatorAction];
  const currentActions = isSubView
    ? (activeParent!.children ?? []).slice(0, 8)
    : mainActions.slice(0, 9);
  const slots = getSlots(currentActions.length, isSubView);

  const cells: React.ReactNode[] = Array(9).fill(null);

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
    );
  }

  slots.forEach((slotIdx, animIdx) => {
    const action = currentActions[animIdx];
    if (!action) return;
    const hasChildren = Boolean(action.children?.length);
    cells[slotIdx] = (
      <motion.button
        key={action.id}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          delay: (isSubView ? animIdx + 1 : animIdx) * 0.02,
          duration: 0.15,
        }}
        onClick={() => {
          if (hasChildren) {
            setActiveParent(action);
          } else {
            action.onClick?.();
            if (action.id !== "__calculator") onClose();
          }
        }}
        className="flex flex-col items-center justify-center gap-1"
        style={{ width: CELL_SIZE, height: CELL_SIZE }}
      >
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full border text-white",
            "bg-white/10 border-white/20",
          )}
        >
          <action.icon className="size-5" />
        </div>
        <span className="max-w-16 truncate text-[10px] text-white/80">
          {action.label}
        </span>
      </motion.button>
    );
  });

  const baseStyle: React.CSSProperties = {
    ...getPanelStyle(snap, fabSize, offsets),
    position: "fixed",
    zIndex: 50,
    padding: PANEL_PAD,
    borderRadius: 20,
    background: "rgba(28, 28, 30, 0.88)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  const panelStyle: React.CSSProperties = calcOpen
    ? { ...baseStyle, width: PANEL_SIZE }
    : {
        ...baseStyle,
        display: "grid",
        gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
      };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onPointerDown={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={panelStyle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {calcOpen ? (
            <motion.div
              key="__calc"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              style={{ width: PANEL_SIZE - 2 * PANEL_PAD }}
            >
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setCalcOpen(false)}
                  className="flex size-7 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-[11px] uppercase tracking-wider text-white/60">
                  Calculator
                </span>
              </div>

              <input
                ref={inputRef}
                value={expr}
                type="text"
                inputMode="tel"
                onChange={(e) => setExpr(e.target.value)}
                placeholder="120 + 50 * 2"
                style={{ fontSize: 16 }}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-mono text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/40"
              />

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-lg font-semibold",
                    result === "—" ? "text-white/40" : "text-white",
                  )}
                >
                  = {result}
                </span>
                <button
                  onClick={handleCopy}
                  disabled={result === "—"}
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white/60 hover:text-white disabled:opacity-40"
                >
                  {copied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <p className="mt-2 text-[10px] text-white/40">
                Supports + − × ÷ ( )
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={isSubView ? activeParent!.id : "__main"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
              }}
            >
              {cells.map((cell, i) => (
                <div key={i} style={{ width: CELL_SIZE, height: CELL_SIZE }}>
                  {cell}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
