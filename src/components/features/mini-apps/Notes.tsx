import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronDown,
  Copy,
  Check,
  Delete,
  RotateCcw,
  ClipboardPaste,
  Bookmark,
  Trash2,
  Pin,
  PinOff,
  Search,
  X,
  ListChecks,
  Save,
  Pencil,
} from "lucide-react";

const STORAGE_KEY = "notes.scratch.v1";

interface ColorOption {
  id: string;
  dot: string;
  ring: string;
  bg: string;
}

const COLORS: ColorOption[] = [
  { id: "default", dot: "bg-white/40",    ring: "border-white/20",       bg: "bg-white/5" },
  { id: "rose",    dot: "bg-rose-400",    ring: "border-rose-400/40",    bg: "bg-rose-500/10" },
  { id: "amber",   dot: "bg-amber-400",   ring: "border-amber-400/40",   bg: "bg-amber-500/10" },
  { id: "emerald", dot: "bg-emerald-400", ring: "border-emerald-400/40", bg: "bg-emerald-500/10" },
  { id: "sky",     dot: "bg-sky-400",     ring: "border-sky-400/40",     bg: "bg-sky-500/10" },
  { id: "violet",  dot: "bg-violet-400",  ring: "border-violet-400/40",  bg: "bg-violet-500/10" },
];

interface NoteEntry {
  id: string;
  text: string;
  color: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

type PasteHint = "ok" | "bad" | null;

interface NotesProps {
  goBack?: () => void;
}

const formatTime = (ts: number): string => {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts).toLocaleDateString();
};

export default function Notes({ goBack }: NotesProps) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("default");
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pasteHint, setPasteHint] = useState<PasteHint>(null);
  const [listOpen, setListOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const selRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  /* ---------- persistence ---------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setNotes(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: NoteEntry[]) => {
    setNotes(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  /* ---------- selection tracking ---------- */
  const captureSel = () => {
    const el = textRef.current;
    if (!el) return;
    let s: number | null, e: number | null;
    try {
      s = el.selectionStart;
      e = el.selectionEnd;
    } catch {
      s = null;
      e = null;
    }
    selRef.current = { start: s ?? text.length, end: e ?? text.length };
  };

  const mutateAtCaret = useCallback(
    (mutator: (v: string, start: number, end: number) => { next: string; caret: number }) => {
      const el = textRef.current;
      const { start, end } = selRef.current;
      const { next, caret } = mutator(text, start, end);
      setText(next);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        try {
          el.setSelectionRange(caret, caret);
        } catch {}
        selRef.current = { start: caret, end: caret };
      });
    },
    [text],
  );

  const insert = (s: string) =>
    mutateAtCaret((v, start, end) => ({
      next: v.slice(0, start) + s + v.slice(end),
      caret: start + s.length,
    }));

  const backspace = () =>
    mutateAtCaret((v, start, end) => {
      if (start !== end) return { next: v.slice(0, start) + v.slice(end), caret: start };
      if (start === 0) return { next: v, caret: 0 };
      return { next: v.slice(0, start - 1) + v.slice(start), caret: start - 1 };
    });

  /* ---------- reset / save / edit ---------- */
  const reset = () => {
    setText("");
    setColor("default");
    setEditingId(null);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      selRef.current = { start: 0, end: 0 };
    });
  };

  const isValid = !!text.trim();

  const save = () => {
    if (!isValid) return;
    const now = Date.now();
    if (editingId) {
      persist(
        notes.map((n) =>
          n.id === editingId ? { ...n, text: text.trim(), color, updatedAt: now } : n,
        ),
      );
    } else {
      const entry: NoteEntry = {
        id: now.toString(36),
        text: text.trim(),
        color,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      persist([entry, ...notes].slice(0, 200));
    }
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      reset();
    }, 700);
  };

  const editNote = (n: NoteEntry) => {
    setText(n.text);
    setColor(n.color || "default");
    setEditingId(n.id);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      const len = n.text.length;
      try {
        textRef.current?.setSelectionRange(len, len);
      } catch {}
      selRef.current = { start: len, end: len };
    });
  };

  const copyNote = async (n: NoteEntry) => {
    try {
      await navigator.clipboard.writeText(n.text);
    } catch {}
  };

  const togglePin = (id: string) =>
    persist(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));

  const remove = (id: string) => {
    if (editingId === id) reset();
    persist(notes.filter((n) => n.id !== id));
  };

  /* ---------- paste ---------- */
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        insert(t);
        setPasteHint("ok");
      } else {
        setPasteHint("bad");
      }
    } catch {
      setPasteHint("bad");
    }
    setTimeout(() => setPasteHint(null), 1200);
  };

  /* ---------- checklist helpers ---------- */
  const insertChecklist = () => {
    const { start } = selRef.current;
    const prefix = start === 0 || text[start - 1] === "\n" ? "" : "\n";
    insert(`${prefix}☐ `);
  };

  const toggleLineCheck = () => {
    const { start } = selRef.current;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", start);
    const endPos = lineEnd === -1 ? text.length : lineEnd;
    const line = text.slice(lineStart, endPos);
    let newLine = line;
    if (line.startsWith("☐ ")) newLine = "☑ " + line.slice(2);
    else if (line.startsWith("☑ ")) newLine = "☐ " + line.slice(2);
    else return;
    const next = text.slice(0, lineStart) + newLine + text.slice(endPos);
    setText(next);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      try {
        textRef.current?.setSelectionRange(start, start);
      } catch {}
    });
  };

  /* ---------- filtering ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => n.text.toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, query]);

  const colorMeta = COLORS.find((c) => c.id === color) ?? COLORS[0];

  /* ---------- focus helpers ---------- */
  const keepFocus = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveDropdown(null);
  };

  const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className={`relative rounded-3xl bg-neutral-900/90 backdrop-blur-xl border ${colorMeta.ring} shadow-2xl flex flex-col max-h-[80vh] transition-colors`}
    >
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
              {editingId ? "EDITING" : "NEW NOTE"}
            </span>
          </div>
          <button
            onMouseDown={keepFocus}
            onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        {/* textarea */}
        <div className="rounded-2xl bg-black/40 border border-white/5 px-4 py-3 mb-3 focus-within:border-white/20 transition">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              captureSel();
            }}
            onSelect={captureSel}
            onKeyUp={captureSel}
            onClick={() => {
              captureSel();
              setActiveDropdown(null);
            }}
            onFocus={() => {
              captureSel();
              setActiveDropdown(null);
            }}
            placeholder="Start writing…"
            rows={6}
            className="w-full bg-transparent outline-none text-base font-light text-white placeholder:text-white/30 resize-none leading-relaxed"
          />
        </div>

        {/* char count + save */}
        <div className="flex items-center justify-between px-1 mb-3 gap-2">
          <span className="text-xs text-white/40 tabular-nums">
            {text.length} chars
            {text.trim() && ` · ${text.trim().split(/\s+/).length} words`}
          </span>
          <button
            onMouseDown={keepFocus}
            onClick={save}
            disabled={!isValid}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {justSaved ? "Saved" : editingId ? "Update" : "Save"}
          </button>
        </div>

        {/* ===================== TOOLBOX ===================== */}
        <div className="space-y-1.5">
          {/* row 1 — colors */}
          <div className="grid grid-cols-6 gap-1.5">
            {COLORS.map((c) => (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.92 }}
                onMouseDown={keepFocus}
                onClick={() => setColor(c.id)}
                className={`h-11 rounded-xl border grid place-items-center transition ${
                  color === c.id
                    ? `${c.bg} ${c.ring}`
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
                title={`${c.id} label`}
              >
                <span className={`w-3 h-3 rounded-full ${c.dot}`} />
              </motion.button>
            ))}
          </div>

          {/* row 2 — actions */}
          <div className="grid grid-cols-8 gap-1.5">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={insertChecklist}
              className="h-11 col-span-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
              title="Add checklist item"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Checkbox
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={toggleLineCheck}
              className="h-11 col-span-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
              title="Toggle current line check"
            >
              <Check className="w-3.5 h-3.5" />
              Toggle
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={paste}
              className={`h-11 col-span-2 rounded-xl border transition grid place-items-center ${
                pasteHint === "ok"
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
                  : pasteHint === "bad"
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-200"
                    : "bg-white/5 border-white/10 hover:bg-white/15 text-white/80"
              }`}
              title="Paste from clipboard"
            >
              <div className="flex items-center gap-1.5 text-xs">
                {pasteHint === "ok" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : pasteHint === "bad" ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <ClipboardPaste className="w-3.5 h-3.5" />
                )}
                {pasteHint === "ok" ? "Pasted" : pasteHint === "bad" ? "Empty" : "Paste"}
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onMouseDown={keepFocus}
              onClick={backspace}
              className="h-11 col-span-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-200 grid place-items-center transition"
              title="Backspace"
            >
              <Delete className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* ===================== RECENT NOTES BAR ===================== */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5 min-w-0">
            {notes.length === 0 ? (
              <span className="text-[11px] text-white/25 italic py-1">No saved notes yet</span>
            ) : (
              notes.slice(0, 5).map((n) => {
                const meta = COLORS.find((c) => c.id === n.color) ?? COLORS[0];
                const firstLine = n.text.split("\n")[0] || "Untitled";
                return (
                  <div key={n.id} className="relative shrink-0">
                    <button
                      onMouseDown={preventBlur}
                      onClick={() =>
                        setActiveDropdown(activeDropdown === n.id ? null : n.id)
                      }
                      className={`h-7 px-2 rounded-lg border text-xs transition flex items-center gap-1.5 max-w-[72px] ${
                        activeDropdown === n.id
                          ? `${meta.bg} ${meta.ring} text-white`
                          : "bg-white/5 border-white/10 hover:bg-white/15 text-white/70"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                      <span className="truncate">{firstLine}</span>
                    </button>

                    <AnimatePresence>
                      {activeDropdown === n.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.1 }}
                          className="absolute bottom-full mb-1.5 left-0 z-20 rounded-xl overflow-hidden border border-white/10 bg-neutral-800 shadow-2xl min-w-[96px]"
                        >
                          <button
                            onMouseDown={preventBlur}
                            onClick={() => {
                              editNote(n);
                              setActiveDropdown(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                          >
                            <Pencil className="w-3 h-3 shrink-0" />
                            Edit
                          </button>
                          <button
                            onMouseDown={preventBlur}
                            onClick={() => {
                              void copyNote(n);
                              setActiveDropdown(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                          >
                            <Copy className="w-3 h-3 shrink-0" />
                            Copy
                          </button>
                          <button
                            onMouseDown={preventBlur}
                            onClick={() => {
                              togglePin(n.id);
                              setActiveDropdown(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10 text-white/80 text-xs transition"
                          >
                            {n.pinned ? (
                              <PinOff className="w-3 h-3 shrink-0" />
                            ) : (
                              <Pin className="w-3 h-3 shrink-0" />
                            )}
                            {n.pinned ? "Unpin" : "Pin"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          {/* caret — opens / closes full notes list */}
          <button
            onMouseDown={keepFocus}
            onClick={() => setListOpen((o) => !o)}
            className="shrink-0 h-7 w-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/50 grid place-items-center transition"
            title={listOpen ? "Hide notes list" : "Show notes list"}
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

      {/* ===================== FULL NOTES LIST (scrollable) ===================== */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto border-t border-white/5 px-5 pb-5 pt-3"
          >
            {/* search bar */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] tracking-[0.2em] text-white/40 font-medium">
                NOTES ({filtered.length}
                {query && filtered.length !== notes.length ? ` / ${notes.length}` : ""})
              </span>
              <button
                onMouseDown={keepFocus}
                onClick={() => {
                  setShowSearch((v) => !v);
                  if (showSearch) setQuery("");
                }}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
              >
                {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                {showSearch ? "Close" : "Search"}
              </button>
            </div>

            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-2"
                >
                  <div className="rounded-2xl bg-black/40 border border-white/10 px-3.5 py-2.5 flex items-center gap-2">
                    <Search className="w-4 h-4 text-white/40 shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search notes…"
                      className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/30"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="text-white/40 hover:text-white/80 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-dashed border-white/10 p-6 text-center"
                >
                  <Bookmark className="w-5 h-5 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">
                    {query ? "No notes match" : "Saved notes will appear here"}
                  </p>
                </motion.div>
              ) : (
                <motion.ul className="space-y-2">
                  {filtered.map((n) => {
                    const meta = COLORS.find((c) => c.id === n.color) ?? COLORS[0];
                    const isEditing = editingId === n.id;
                    const firstLine = n.text.split("\n")[0];
                    const restLines = n.text.split("\n").slice(1).join("\n");
                    return (
                      <motion.li
                        key={n.id}
                        layout
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`rounded-2xl ${meta.bg} border ${
                          isEditing ? "border-emerald-500/40" : meta.ring
                        } p-3`}
                      >
                        <button
                          onMouseDown={keepFocus}
                          onClick={() => editNote(n)}
                          className="w-full text-left group"
                        >
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${meta.dot} shrink-0`} />
                              <span className="text-sm font-medium text-white truncate">
                                {firstLine || "Untitled"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {n.pinned && (
                                <Pin className="w-3 h-3 text-amber-300 fill-amber-300/40" />
                              )}
                              <span className="text-[10px] text-white/40 tabular-nums">
                                {formatTime(n.updatedAt)}
                              </span>
                            </div>
                          </div>
                          {restLines && (
                            <p className="text-xs text-white/50 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                              {restLines}
                            </p>
                          )}
                        </button>

                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          <button
                            onMouseDown={keepFocus}
                            onClick={() => editNote(n)}
                            className="h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onMouseDown={keepFocus}
                            onClick={() => togglePin(n.id)}
                            className={`h-8 rounded-lg border text-[11px] flex items-center justify-center gap-1 transition ${
                              n.pinned
                                ? "bg-amber-500/15 border-amber-500/25 text-amber-200"
                                : "bg-white/5 border-white/10 hover:bg-white/15 text-white/80"
                            }`}
                          >
                            {n.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                            {n.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            onMouseDown={keepFocus}
                            onClick={() => void copyNote(n)}
                            className="h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-[11px] flex items-center justify-center gap-1 transition"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                          <button
                            onMouseDown={keepFocus}
                            onClick={() => remove(n.id)}
                            className="h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-200 text-[11px] flex items-center justify-center gap-1 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
