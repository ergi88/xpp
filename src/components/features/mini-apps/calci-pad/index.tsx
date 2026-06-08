import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronDown,
  Settings2,
  HelpCircle,
  Keyboard,
  Hash,
  Plus,
  Pencil,
  Trash2,
  Check,
  CornerDownLeft,
} from "lucide-react";
import { useCurrencies } from "@/hooks/use-currencies";
import type { Page, Currency } from "./types";
import { DEFAULT_CURRENCIES } from "./types";
import { evaluateText } from "./lib/calculator";
import {
  loadPages,
  savePages,
  loadCurrencies,
  saveCurrencies,
  loadPrecision,
  savePrecision,
  loadActivePageId,
  saveActivePageId,
} from "./lib/persistence";
import { Editor } from "./Editor";
import { Results } from "./Results";
import { Footer } from "./Footer";
import { Settings } from "./Settings";
import { CheatSheet } from "./CheatSheet";

const STORAGE_PREFIX = "xpp_calcipad";

const PAGE_COLORS = [
  {
    id: "default",
    dot: "bg-white/40",
    ring: "border-white/20",
    bg: "bg-white/5",
  },
  {
    id: "rose",
    dot: "bg-rose-400",
    ring: "border-rose-400/40",
    bg: "bg-rose-500/10",
  },
  {
    id: "amber",
    dot: "bg-amber-400",
    ring: "border-amber-400/40",
    bg: "bg-amber-500/10",
  },
  {
    id: "emerald",
    dot: "bg-emerald-400",
    ring: "border-emerald-400/40",
    bg: "bg-emerald-500/10",
  },
  {
    id: "sky",
    dot: "bg-sky-400",
    ring: "border-sky-400/40",
    bg: "bg-sky-500/10",
  },
  {
    id: "violet",
    dot: "bg-violet-400",
    ring: "border-violet-400/40",
    bg: "bg-violet-500/10",
  },
];

function createPage(title = "Untitled"): Page {
  return {
    id: crypto.randomUUID(),
    title,
    content: "",
    color: "default",
    lastModified: new Date().toISOString(),
  };
}

interface CalciPadProps {
  goBack?: () => void;
}

export default function CalciPad({ goBack }: CalciPadProps) {
  const prefix = STORAGE_PREFIX;

  // ── textarea ref + caret tracking ──────────────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const captureSel = () => {
    const el = textareaRef.current;
    if (!el) return;
    try {
      selRef.current = {
        start: el.selectionStart ?? 0,
        end: el.selectionEnd ?? 0,
      };
    } catch {
      // some browsers throw on selectionStart for certain inputModes
    }
  };

  // ── pages ──────────────────────────────────────────────────────────────────
  const initRef = useRef<{ pages: Page[]; activePageId: string } | null>(null);
  if (initRef.current === null) {
    const loaded = loadPages(prefix);
    const pages =
      loaded.length > 0
        ? loaded.map((p) => ({ ...p, color: p.color ?? "default" })) // migrate old entries
        : [createPage()];
    const saved = loadActivePageId(prefix);
    const activePageId =
      saved && pages.some((p) => p.id === saved) ? saved : pages[0].id;
    initRef.current = { pages, activePageId };
  }

  const [pages, setPages] = useState<Page[]>(initRef.current.pages);
  const [activePageId, setActivePageId] = useState<string>(
    initRef.current.activePageId,
  );

  // ── currencies ─────────────────────────────────────────────────────────────
  const { data: appCurrencies } = useCurrencies();
  const hasSeededRef = useRef(loadCurrencies(prefix).length > 0);

  const [currencies, setCurrencies] = useState<Currency[]>(() => {
    const stored = loadCurrencies(prefix);
    return stored.length > 0 ? stored : DEFAULT_CURRENCIES;
  });

  // Seed from app sheet the first time there's nothing stored locally
  useEffect(() => {
    if (hasSeededRef.current) return;
    if (!appCurrencies?.length) return;
    hasSeededRef.current = true;
    setCurrencies(
      appCurrencies.map((c) => ({
        id: String(c.id),
        code: c.code,
        symbol: c.symbol,
        rate: c.rate ?? 1,
      })),
    );
  }, [appCurrencies]);

  // ── settings ───────────────────────────────────────────────────────────────
  const [precision, setPrecision] = useState<number>(() =>
    loadPrecision(prefix),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"decimal" | "number">("decimal");
  const [listOpen, setListOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── derived ────────────────────────────────────────────────────────────────
  const activePage = pages.find((p) => p.id === activePageId);
  const inputText = activePage?.content ?? "";
  const results = evaluateText(
    inputText,
    precision > 0 ? precision : null,
    currencies,
  );
  const activeColor =
    PAGE_COLORS.find((c) => c.id === (activePage?.color ?? "default")) ??
    PAGE_COLORS[0];

  // ── persistence ────────────────────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => savePages(pages, prefix), 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [pages, prefix]);

  useEffect(() => {
    if (currencies.length > 0) saveCurrencies(currencies, prefix);
  }, [currencies, prefix]);
  useEffect(() => {
    savePrecision(precision, prefix);
  }, [precision, prefix]);
  useEffect(() => {
    if (activePageId) saveActivePageId(activePageId, prefix);
  }, [activePageId, prefix]);

  // ── page handlers ──────────────────────────────────────────────────────────
  function handleInputChange(text: string) {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== activePageId) return p;
        const firstLine = text.split("\n")[0]?.trim() ?? "";
        const title = p.title === "Untitled" && firstLine ? firstLine : p.title;
        return {
          ...p,
          content: text,
          title,
          lastModified: new Date().toISOString(),
        };
      }),
    );
  }

  function handleAddPage() {
    const page = createPage();
    setPages((prev) => [...prev, page]);
    setActivePageId(page.id);
    setActiveDropdown(null);
  }

  function handleDeletePage(id: string) {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length === 0) {
        const fresh = createPage();
        setActivePageId(fresh.id);
        return [fresh];
      }
      if (activePageId === id) setActivePageId(next[0].id);
      return next;
    });
    setActiveDropdown(null);
  }

  function handleRenamePage(id: string, title: string) {
    if (title.trim())
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, title: title.trim() } : p)),
      );
    setRenamingId(null);
    setActiveDropdown(null);
  }

  function handleSetPageColor(colorId: string) {
    setPages((prev) =>
      prev.map((p) => (p.id === activePageId ? { ...p, color: colorId } : p)),
    );
  }

  function handleInsert(text: string) {
    const { start, end } = selRef.current;
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== activePageId) return p;
        const next = p.content.slice(0, start) + text + p.content.slice(end);
        return { ...p, content: next, lastModified: new Date().toISOString() };
      }),
    );
    const newCaret = start + text.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(newCaret, newCaret);
      } catch {}
      selRef.current = { start: newCaret, end: newCaret };
    });
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative rounded-3xl bg-neutral-900/90 backdrop-blur-xl border ${activeColor.ring} shadow-2xl flex flex-col overflow-hidden transition-colors`}
    >
      {/* ── 1. Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10 transition"
          >
            <ChevronLeft className="w-4 h-4 text-white/80" />
          </button>
          <span className="text-xs tracking-[0.25em] text-white/60 font-medium">
            CALCI PAD
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Settings
          </button>
          <button
            onClick={() => setShowCheatSheet(true)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition grid place-items-center"
            title="Help / cheat sheet"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setMode((m) => (m === "decimal" ? "number" : "decimal"));
              requestAnimationFrame(() => {
                const el = textareaRef.current;
                if (!el) return;
                el.focus();
                try {
                  el.setSelectionRange(selRef.current.start, selRef.current.end);
                } catch {}
              });
            }}
            className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 hover:bg-sky-500/20 transition grid place-items-center"
            title={mode === "decimal" ? "Switch to full keyboard" : "Switch to number pad"}
          >
            {mode === "decimal" ? (
              <Keyboard className="w-3.5 h-3.5" />
            ) : (
              <Hash className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ── 2. Body: editor + results ─────────────────────────────────────── */}
      <div className="flex shrink-0" style={{ height: 190 }}>
        <Editor
          ref={textareaRef}
          value={inputText}
          onChange={handleInputChange}
          onSelectionChange={captureSel}
          inputMode={mode === "decimal" ? "decimal" : "text"}
        />
        <Results results={results} />
      </div>

      {/* ── 3. Actions footer (operators / keywords / units) ──────────────── */}
      <Footer currencies={currencies} onInsert={handleInsert} />

      {/* ── 4. Colors row ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-1.5 shrink-0">
        {PAGE_COLORS.map((c) => (
          <motion.button
            key={c.id}
            whileTap={{ scale: 0.88 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetPageColor(c.id)}
            className={`w-8 h-8 rounded-xl border grid place-items-center transition ${
              (activePage?.color ?? "default") === c.id
                ? `${c.bg} ${c.ring}`
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
          </motion.button>
        ))}
      </div>

      {/* ── 5. Pages bar ──────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-1.5 shrink-0">
        {/* + New */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAddPage}
          className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/60 grid place-items-center transition shrink-0"
          title="New page"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>

        {/* Page chips */}
        <div className="flex flex-1 gap-1.5 min-w-0 overflow-hidden">
          {pages.map((page) => {
            const meta =
              PAGE_COLORS.find((c) => c.id === (page.color ?? "default")) ??
              PAGE_COLORS[0];
            const isActive = page.id === activePageId;
            return (
              <div key={page.id} className="relative shrink-0">
                {renamingId === page.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenamePage(page.id, renameValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleRenamePage(page.id, renameValue);
                      if (e.key === "Escape") {
                        setRenamingId(null);
                        setActiveDropdown(null);
                      }
                    }}
                    className="h-7 px-2 rounded-lg border border-emerald-500/40 bg-white/5 text-white text-xs outline-none w-24"
                  />
                ) : (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (isActive) {
                        setActiveDropdown(
                          activeDropdown === page.id ? null : page.id,
                        );
                      } else {
                        setActivePageId(page.id);
                        setActiveDropdown(null);
                      }
                    }}
                    className={`h-7 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition max-w-20 truncate ${
                      isActive
                        ? "bg-white/15 border-white/20 text-white"
                        : "bg-white/5 border-white/10 hover:bg-white/15 text-white/60"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`}
                    />
                    <span className="truncate">{page.title}</span>
                  </button>
                )}

                <AnimatePresence>
                  {activeDropdown === page.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute bottom-full mb-1.5 left-0 z-20 rounded-xl overflow-hidden border border-white/10 bg-neutral-800 shadow-2xl min-w-22"
                    >
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setRenameValue(page.title);
                          setRenamingId(page.id);
                          setActiveDropdown(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                      >
                        <Pencil className="w-3 h-3 shrink-0" />
                        Rename
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleDeletePage(page.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-rose-300 text-xs transition"
                      >
                        <Trash2 className="w-3 h-3 shrink-0" />
                        Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Expand toggle */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setListOpen((o) => !o)}
          className="shrink-0 h-7 w-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/50 grid place-items-center transition"
          title={listOpen ? "Collapse pages" : "Expand pages"}
        >
          <motion.div
            animate={{ rotate: listOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </button>
      </div>

      {/* ── 6. Expanded pages list ────────────────────────────────────────── */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-white/5 px-4 pb-4 pt-3 overflow-y-auto"
            style={{ maxHeight: 220 }}
          >
            <AnimatePresence initial={false}>
              {pages.map((page) => {
                const meta =
                  PAGE_COLORS.find((c) => c.id === (page.color ?? "default")) ??
                  PAGE_COLORS[0];
                const isActive = page.id === activePageId;
                return (
                  <motion.div
                    key={page.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`rounded-2xl border p-3 mb-2 last:mb-0 ${meta.bg} ${isActive ? "border-emerald-500/30" : meta.ring}`}
                  >
                    <button
                      onClick={() => setActivePageId(page.id)}
                      className="w-full text-left flex items-center gap-2 mb-2"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`}
                      />
                      <span className="text-sm font-medium text-white truncate flex-1">
                        {page.title}
                      </span>
                      {isActive && (
                        <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      )}
                    </button>
                    {page.content && (
                      <p className="text-xs text-white/40 font-mono truncate mb-2 leading-relaxed">
                        {page.content.split("\n")[0]}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          setActivePageId(page.id);
                          setListOpen(false);
                        }}
                        className="h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <CornerDownLeft className="w-3 h-3" />
                        Open
                      </button>
                      <button
                        onClick={() => {
                          setRenameValue(page.title);
                          setRenamingId(page.id);
                          setListOpen(false);
                        }}
                        className="h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <Pencil className="w-3 h-3" />
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeletePage(page.id)}
                        className="h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-200 text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      {showSettings && (
        <Settings
          precision={precision}
          currencies={currencies}
          onPrecisionChange={setPrecision}
          onCurrencyAdd={(c) => setCurrencies((prev) => [...prev, c])}
          onCurrencyDelete={(id) =>
            setCurrencies((prev) => prev.filter((c) => c.id !== id))
          }
          onClose={() => setShowSettings(false)}
        />
      )}
      {showCheatSheet && (
        <CheatSheet onClose={() => setShowCheatSheet(false)} />
      )}
    </div>
  );
}
