import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronDown,
  Copy,
  Check,
  Delete,
  Hash,
  Keyboard,
  Equal,
  RotateCcw,
  ClipboardPaste,
  Bookmark,
  BookmarkPlus,
  Trash2,
  Plus,
  CornerDownLeft,
} from "lucide-react";

/* ---------- evaluator ---------- */
const safeEval = (expr: string): number | string => {
  if (!expr || !expr.trim()) return "";
  try {
    const cleaned = expr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/[^0-9+\-*/().%\s]/g, "");
    if (!cleaned) return "";
    // basic guards against trailing operators producing NaN
    if (/[+\-*/.(%]\s*$/.test(cleaned)) return "";
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${cleaned})`)();
    if (typeof v !== "number" || !isFinite(v)) return "";
    return Math.round(v * 1e10) / 1e10;
  } catch {
    return "";
  }
};

const STORAGE_KEY = "calc.saved.v1";

interface SavedEntry {
  id: string;
  expr: string;
  total: number | string;
  at: number;
}

type Mode = "decimal" | "number";
type PasteHint = "ok" | "bad" | null;

interface CalculatorProps {
  goBack?: () => void;
}

export default function Calculator({ goBack }: CalculatorProps) {
  const [val, setVal] = useState("120 + 50 × 2");
  const [mode, setMode] = useState<Mode>("decimal");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [pasteHint, setPasteHint] = useState<PasteHint>(null);
  const [listOpen, setListOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // initialize to end of starting value so first toolbar action appends instead of replacing from 0
  const selRef = useRef<{ start: number; end: number }>({
    start: "120 + 50 × 2".length,
    end: "120 + 50 × 2".length,
  });

  const result = safeEval(val);
  const isValid = result !== "";

  /* ---------- load saved from storage ---------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: SavedEntry[]) => {
    setSaved(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  /* ---------- selection tracking (so onMouseDown handlers don't lose caret) ---------- */
  const captureSel = () => {
    const el = inputRef.current;
    if (!el) return;
    let start: number | null, end: number | null;
    try {
      start = el.selectionStart;
      end = el.selectionEnd;
    } catch {
      // some input types (e.g. number) throw when reading selection
      start = null;
      end = null;
    }
    selRef.current = {
      start: start ?? val.length,
      end: end ?? val.length,
    };
  };

  const onSelect = () => captureSel();

  /* ---------- core insert / mutate at caret WITHOUT losing focus ---------- */
  const mutateAtCaret = useCallback(
    (
      mutator: (
        v: string,
        start: number,
        end: number,
      ) => { next: string; caret: number },
    ) => {
      const el = inputRef.current;
      const { start, end } = selRef.current;
      const { next, caret } = mutator(val, start, end);
      setVal(next);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        try {
          el.setSelectionRange(caret, caret);
        } catch {}
        selRef.current = { start: caret, end: caret };
      });
    },
    [val],
  );

  const insert = (s: string) =>
    mutateAtCaret((v, start, end) => {
      const next = v.slice(0, start) + s + v.slice(end);
      return { next, caret: start + s.length };
    });

  const backspace = () =>
    mutateAtCaret((v, start, end) => {
      if (start !== end) {
        return { next: v.slice(0, start) + v.slice(end), caret: start };
      }
      if (start === 0) return { next: v, caret: 0 };
      return { next: v.slice(0, start - 1) + v.slice(start), caret: start - 1 };
    });

  const reset = () => {
    setVal("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      selRef.current = { start: 0, end: 0 };
    });
  };

  /* ---------- clipboard ---------- */
  const copy = async () => {
    if (!isValid) return;
    try {
      await navigator.clipboard.writeText(String(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      // accept a valid number (int/float, optional minus)
      if (/^-?\d+(\.\d+)?$/.test(text)) {
        insert(text);
        setPasteHint("ok");
      } else {
        setPasteHint("bad");
      }
    } catch {
      setPasteHint("bad");
    }
    setTimeout(() => setPasteHint(null), 1200);
  };

  /* ---------- save / restore ---------- */
  const save = () => {
    if (!isValid) return;
    const entry: SavedEntry = {
      id: Date.now().toString(36),
      expr: val.trim(),
      total: result,
      at: Date.now(),
    };
    persist([entry, ...saved].slice(0, 50));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const reEnter = (item: SavedEntry) => {
    setVal(item.expr);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const len = item.expr.length;
      try {
        inputRef.current?.setSelectionRange(len, len);
      } catch {}
      selRef.current = { start: len, end: len };
    });
  };

  const copyTotal = async (item: SavedEntry) => {
    try {
      await navigator.clipboard.writeText(String(item.total));
    } catch {}
  };

  const addTotal = (item: SavedEntry) => insert(String(item.total));

  const remove = (id: string) => persist(saved.filter((s) => s.id !== id));

  /* ---------- focus helpers ---------- */
  // prevents input blur AND closes any open dropdown
  const keepFocus = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveDropdown(null);
  };

  // prevents input blur only — used on chip/dropdown buttons that manage their own state
  const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  /* ---------- toolbar config ---------- */
  const row1 = ["+", "−", "×", "÷", "(", ")", "%", "."];

  return (
    <div className="relative rounded-3xl bg-neutral-900/90 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col max-h-[75vh]">
      {/* ===== fixed main section ===== */}
      <div className="p-5 shrink-0">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10 transition"
            >
              <ChevronLeft className="w-4 h-4 text-white/80" />
            </button>
            <span className="text-xs tracking-[0.25em] text-white/60 font-medium">
              CALCULATOR
            </span>
          </div>
          <button
            onMouseDown={keepFocus}
            onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        {/* input */}
        <div className="rounded-2xl bg-black/40 border border-white/5 px-4 py-3 mb-3 focus-within:border-white/20 transition">
          <input
            ref={inputRef}
            type="text"
            inputMode={mode === "decimal" ? "decimal" : "text"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              captureSel();
            }}
            onSelect={onSelect}
            onKeyUp={onSelect}
            onClick={() => {
              onSelect();
              setActiveDropdown(null);
            }}
            onFocus={() => {
              onSelect();
              setActiveDropdown(null);
            }}
            placeholder="0"
            className="w-full bg-transparent outline-none text-2xl font-light text-white tracking-wide placeholder:text-white/30"
          />
        </div>

        {/* live result + copy + save */}
        <div className="flex items-center justify-between px-1 mb-3 gap-2">
          <div className="flex items-baseline gap-2 min-w-0 flex-1">
            <Equal className="w-4 h-4 text-white/40 shrink-0" />
            <AnimatePresence mode="popLayout">
              <motion.span
                key={String(result)}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-2xl font-light text-emerald-300 tabular-nums truncate"
              >
                {isValid ? result : "—"}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onMouseDown={keepFocus}
              onClick={save}
              disabled={!isValid}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Save calculation"
            >
              {justSaved ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5" />
              )}
              {justSaved ? "Saved" : "Save"}
            </button>
            <button
              onMouseDown={keepFocus}
              onClick={copy}
              disabled={!isValid}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* ===================== TOOLBOX ===================== */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-1.5"
        >
          {/* row 1 — operators */}
          <div className="grid grid-cols-8 gap-1.5">
            {row1.map((op) => (
              <motion.button
                key={op}
                whileTap={{ scale: 0.92 }}
                onMouseDown={keepFocus}
                onClick={() => insert(op)}
                className="h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-white text-lg font-medium transition"
              >
                {op}
              </motion.button>
            ))}
          </div>

          {/* row 2 — utilities */}
          <div className="grid grid-cols-8 gap-1.5">
            {/* 00 */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={() => insert("00")}
              className="h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-white text-base font-medium tabular-nums transition"
            >
              00
            </motion.button>

            {/* paste */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={paste}
              className={`h-11 rounded-xl border transition grid place-items-center col-span-2 ${
                pasteHint === "ok"
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
                  : pasteHint === "bad"
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-200"
                    : "bg-white/5 border-white/10 hover:bg-white/15 text-white/80"
              }`}
              title="Paste number from clipboard"
            >
              <div className="flex items-center gap-1.5 text-xs">
                {pasteHint === "ok" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : pasteHint === "bad" ? (
                  <Delete className="w-3.5 h-3.5" />
                ) : (
                  <ClipboardPaste className="w-3.5 h-3.5" />
                )}
                {pasteHint === "ok"
                  ? "Pasted"
                  : pasteHint === "bad"
                    ? "Not a number"
                    : "Paste"}
              </div>
            </motion.button>

            {/* backspace */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={backspace}
              className="h-11 col-span-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-200 grid place-items-center transition"
              title="Backspace"
            >
              <Delete className="w-4 h-4" />
            </motion.button>

            {/* keyboard toggle */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={() =>
                setMode((m) => (m === "decimal" ? "number" : "decimal"))
              }
              className="h-11 col-span-3 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 text-sky-200 transition"
              title="Toggle keyboard"
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
                {mode === "decimal" ? (
                  <>
                    <Keyboard className="w-3.5 h-3.5" />
                    Full keyboard
                  </>
                ) : (
                  <>
                    <Hash className="w-3.5 h-3.5" />
                    Number pad
                  </>
                )}
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* ===================== RECENT SAVES BAR ===================== */}
        <div className="mt-3 flex items-center gap-2">
          {/* chips — up to 5 most recent totals */}
          <div className="flex flex-1 gap-1.5 min-w-0">
            {saved.length === 0 ? (
              <span className="text-[11px] text-white/25 italic py-1">
                No saved items yet
              </span>
            ) : (
              saved.slice(0, 5).map((item) => (
                <div key={item.id} className="relative shrink-0">
                  <button
                    onMouseDown={preventBlur}
                    onClick={() =>
                      setActiveDropdown(
                        activeDropdown === item.id ? null : item.id,
                      )
                    }
                    className={`h-7 px-2.5 rounded-lg border text-xs tabular-nums transition max-w-16 truncate ${
                      activeDropdown === item.id
                        ? "bg-white/15 border-white/20 text-white"
                        : "bg-white/5 border-white/10 hover:bg-white/15 text-white/70"
                    }`}
                  >
                    {String(item.total)}
                  </button>

                  <AnimatePresence>
                    {activeDropdown === item.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute bottom-full mb-1.5 left-0 z-20 rounded-xl overflow-hidden border border-white/10 bg-neutral-800 shadow-2xl min-w-24"
                      >
                        <button
                          onMouseDown={preventBlur}
                          onClick={() => {
                            reEnter(item);
                            setActiveDropdown(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                        >
                          <CornerDownLeft className="w-3 h-3 shrink-0" />
                          Re-enter
                        </button>
                        <button
                          onMouseDown={preventBlur}
                          onClick={() => {
                            addTotal(item);
                            setActiveDropdown(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                        >
                          <Plus className="w-3 h-3 shrink-0" />
                          Add
                        </button>
                        <button
                          onMouseDown={preventBlur}
                          onClick={() => {
                            void copyTotal(item);
                            setActiveDropdown(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                        >
                          <Copy className="w-3 h-3 shrink-0" />
                          Copy
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>

          {/* caret — opens / closes full saved list */}
          <button
            onMouseDown={keepFocus}
            onClick={() => setListOpen((o) => !o)}
            className="shrink-0 h-7 w-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/50 grid place-items-center transition"
            title={listOpen ? "Hide saved list" : "Show saved list"}
          >
            <motion.div
              animate={{ rotate: listOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* ===================== FULL SAVED LIST (scrollable) ===================== */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto border-t border-white/5 px-5 pb-5 pt-3"
          >
            <AnimatePresence initial={false}>
              {saved.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-dashed border-white/10 p-5 text-center"
                >
                  <Bookmark className="w-5 h-5 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">
                    Saved calculations will appear here
                  </p>
                </motion.div>
              ) : (
                <motion.ul className="space-y-2 ">
                  {saved.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="rounded-2xl bg-neutral-800/80 border border-white/10 p-3"
                    >
                      {/* label = total, sub = expression */}
                      <button
                        onMouseDown={keepFocus}
                        onClick={() => reEnter(item)}
                        className="w-full text-left flex items-baseline justify-between gap-3 group"
                        title="Re-enter this calculation"
                      >
                        <span className="text-xl font-light text-emerald-300 tabular-nums">
                          {item.total}
                        </span>
                        <span className="text-xs text-white/40 truncate group-hover:text-white/60 transition">
                          {item.expr}
                        </span>
                      </button>

                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        <button
                          onMouseDown={keepFocus}
                          onClick={() => reEnter(item)}
                          className="h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                          title="Re-enter full calculation"
                        >
                          <CornerDownLeft className="w-3 h-3" />
                          Re-enter
                        </button>
                        <button
                          onMouseDown={keepFocus}
                          onClick={() => addTotal(item)}
                          className="h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                          title="Add total to input"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                        <button
                          onMouseDown={keepFocus}
                          onClick={() => void copyTotal(item)}
                          className="h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                          title="Copy total"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                        <button
                          onMouseDown={keepFocus}
                          onClick={() => remove(item.id)}
                          className="h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-200 text-[11px] flex items-center justify-center gap-1 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
