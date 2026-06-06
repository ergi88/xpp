import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sheet, useVirtualKeyboard } from "react-modal-sheet";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BottomSheetItem = {
  id: string;
  label: string;
  description?: string;
  iconNode?: ReactNode;
  /** Hex color (#RRGGBB) used to tint the active state for this item. */
  color?: string;
  /** Right-aligned accessory (e.g. balance, currency). */
  right?: ReactNode;
  /** Extra haystack searched in addition to label and description. */
  keywords?: string;
};

type BaseProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  items: BottomSheetItem[];
  layout?: "grid" | "list";
  /** Column count for the grid layout. Defaults to 4. */
  gridCols?: number;
  searchable?: boolean;
  onCreate?: () => void;
  createLabel?: string;
  emptyMessage?: string;
};

type SingleProps = BaseProps & {
  multi?: false;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  selectedIds?: never;
  onSelectMulti?: never;
};

type MultiProps = BaseProps & {
  multi: true;
  selectedIds: string[];
  onSelectMulti: (ids: string[]) => void;
  selectedId?: never;
  onSelect?: never;
};

export type BottomSheetProps = SingleProps | MultiProps;

export function BottomSheet(props: BottomSheetProps) {
  const {
    open,
    onClose,
    title,
    description,
    items,
    layout = "list",
    gridCols = 4,
    searchable = false,
    onCreate,
    createLabel = "Create new",
    emptyMessage = "No results",
  } = props;

  const initialSnap = 1;
  const [snapPoint, setSnapPoint] = useState(initialSnap);

  useVirtualKeyboard();

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const hay =
        `${i.label} ${i.description ?? ""} ${i.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const isActive = (id: string) =>
    props.multi ? props.selectedIds.includes(id) : props.selectedId === id;

  const toggle = (id: string) => {
    if (props.multi) {
      const next = props.selectedIds.includes(id)
        ? props.selectedIds.filter((x) => x !== id)
        : [...props.selectedIds, id];
      props.onSelectMulti(next);
    } else {
      props.onSelect(id);
      onClose();
    }
  };

  const selectedCount = props.multi ? props.selectedIds.length : 0;

  return (
    <Sheet
      isOpen={open}
      onClose={onClose}
      // detent="content"
      style={{ zIndex: 60, maxWidth: "600px", margin: "0 auto" }}
      snapPoints={[0, -200, 1]}
      initialSnap={1}
      onSnap={setSnapPoint}
    >
      <Sheet.Container
        className="backdrop-blur-xl bg-card/95! supports-backdrop-filter:bg-card/80! border-t border-border"
        style={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <Sheet.Header>
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-start justify-between gap-3 px-5 pb-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{title}</h2>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {props.multi && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  Done{selectedCount > 0 && ` · ${selectedCount}`}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
          {searchable && (
            <div className="flex items-center gap-2 px-5 pb-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-muted-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {onCreate && (
                <button
                  type="button"
                  onClick={() => {
                    onCreate();
                    onClose();
                  }}
                  className="flex h-9.5 shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/15 px-3 text-xs font-medium text-primary transition hover:bg-primary/25"
                >
                  <Plus className="size-3.5" />
                  New
                </button>
              )}
            </div>
          )}
        </Sheet.Header>
        <Sheet.Content
          style={{
            maxHeight: snapPoint === 1 ? "calc(100dvh - 330px)" : "100vh",
          }}
        >
          <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {layout === "grid" ? (
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                }}
              >
                {filtered.map((item) => {
                  const active = isActive(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border transition",
                        active
                          ? "bg-accent"
                          : "border-border bg-card/40 hover:bg-accent/40",
                      )}
                      style={
                        active && item.color
                          ? {
                              backgroundColor: `${item.color}1a`,
                              borderColor: `${item.color}66`,
                            }
                          : undefined
                      }
                    >
                      {item.iconNode}
                      <span
                        className={cn(
                          "w-full truncate px-1 text-center text-[10px]",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                        style={
                          active && item.color
                            ? { color: item.color }
                            : undefined
                        }
                      >
                        {item.label}
                      </span>
                      {active && (
                        <div
                          className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-primary"
                          style={
                            item.color
                              ? { backgroundColor: item.color }
                              : undefined
                          }
                        >
                          <Check className="size-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
                {onCreate && !searchable && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreate();
                      onClose();
                    }}
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition hover:border-muted-foreground/60 hover:text-foreground"
                  >
                    <Plus className="size-6" />
                    <span className="text-[10px]">{createLabel}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((item) => {
                  const active = isActive(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
                        active
                          ? "bg-accent"
                          : "border-border bg-card/40 hover:bg-accent/40",
                      )}
                      style={
                        active && item.color
                          ? {
                              backgroundColor: `${item.color}1a`,
                              borderColor: `${item.color}66`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {item.iconNode && (
                          <div
                            className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/50"
                            style={
                              item.color
                                ? { backgroundColor: `${item.color}1a` }
                                : undefined
                            }
                          >
                            {item.iconNode}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.right && (
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {item.right}
                          </div>
                        )}
                        {active && (
                          <div
                            className="grid size-5 place-items-center rounded-full bg-primary"
                            style={
                              item.color
                                ? { backgroundColor: item.color }
                                : undefined
                            }
                          >
                            <Check className="size-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {onCreate && !searchable && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreate();
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border px-3.5 py-3 text-left text-muted-foreground transition hover:border-muted-foreground/60 hover:text-foreground"
                  >
                    <div className="grid size-9 place-items-center rounded-xl bg-muted/50">
                      <Plus className="size-4" />
                    </div>
                    <span className="text-sm font-medium">{createLabel}</span>
                  </button>
                )}
              </div>
            )}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
