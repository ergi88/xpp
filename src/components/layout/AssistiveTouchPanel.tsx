import type React from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Calculator as CalcIcon,
  StickyNote as NotesIcon,
  NotebookText as CalciPadIcon,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type EdgeSnap, type EdgeOffsets } from "@/lib/fab-edge-snap";
import type { FABAction } from "@/lib/fab-context";
import Calculator from "../features/mini-apps/Calculator";
import Notes from "../features/mini-apps/Notes";
import CalciPad from "../features/mini-apps/calci-pad";

const CELL_SIZE = 72;
const PANEL_PAD = 8;

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
        top: `${snap.position - CELL_SIZE - GAP}px`,
      };
    case "right":
      return {
        right: `${offsets.side + fabSize + GAP}px`,
        top: `${snap.position - CELL_SIZE - GAP}px`,
      };
    case "top":
      return {
        top: `${offsets.top + fabSize + GAP}px`,
        left: `${snap.position - CELL_SIZE - GAP}px`,
      };
    case "bottom":
      return {
        bottom: `${offsets.bottom + fabSize + GAP}px`,
        left: `${snap.position - CELL_SIZE - GAP}px`,
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [calciPadOpen, setCalciPadOpen] = useState(false);

  const calculatorAction: FABAction = {
    id: "__calculator",
    label: "Calculator",
    icon: CalcIcon,
    onClick: () => setCalcOpen(true),
  };

  const notesAction: FABAction = {
    id: "__notes",
    label: "Notes",
    icon: NotesIcon,
    onClick: () => setNotesOpen(true),
  };

  const calciPadAction: FABAction = {
    id: "__calcipad",
    label: "Calci Pad",
    icon: CalciPadIcon,
    onClick: () => setCalciPadOpen(true),
  };

  const isSubView = Boolean(activeParent);
  const mainActions = [
    ...actions,
    // calculatorAction, notesAction,
    calciPadAction,
  ];
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
            if (
              action.id !== "__calculator" &&
              action.id !== "__notes" &&
              action.id !== "__calcipad"
            )
              onClose();
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

  const gridPanelStyle: React.CSSProperties = {
    ...getPanelStyle(snap, fabSize, offsets),
    position: "fixed",
    zIndex: 50,
    padding: PANEL_PAD,
    borderRadius: 20,
    background: "rgba(28, 28, 30, 0.88)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "grid",
    gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-0 bg-black/40" onPointerDown={onClose} />

      {/* Grid panel — hidden while any modal is open */}
      <AnimatePresence>
        {!calcOpen && !notesOpen && !calciPadOpen && (
          <motion.div
            key="grid-panel"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={gridPanelStyle}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait">
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
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculator — full-screen modal */}
      <AnimatePresence>
        {calcOpen && (
          <motion.div
            key="calc-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-500 bg-black/70 flex justify-center pt-25"
            onPointerDown={() => setCalcOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md max-h-[75dvh] h-max overflow-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Calculator goBack={() => setCalcOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes — full-screen modal */}
      <AnimatePresence>
        {notesOpen && (
          <motion.div
            key="notes-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-500 bg-black/70 flex justify-center pt-25"
            onPointerDown={() => setNotesOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md max-h-[75dvh] h-max overflow-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Notes goBack={() => setNotesOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calci Pad — full-screen modal */}
      <AnimatePresence>
        {calciPadOpen && (
          <motion.div
            key="calcipad-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-500 bg-black/70 flex justify-center pt-25"
            onPointerDown={() => setCalciPadOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg max-h-[75dvh] h-max overflow-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <CalciPad goBack={() => setCalciPadOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
