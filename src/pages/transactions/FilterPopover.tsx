import { useState } from "react";
import {
  Layers,
  LayoutGrid,
  Clock,
  DollarSign,
  Tag,
  Hash,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryPill } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/categories";
import type { Tag as TagType } from "@/types/tags";
import type { Account } from "@/types/accounts";

// ─── FilterState ────────────────────────────────────────────────────────────

export interface FilterState {
  accountIds: string[];
  categoryIds: string[];
  tagIds: string[];
  types: ("income" | "expense" | "transfer")[];
  showExcluded: boolean;
  showSplitChildren: boolean;
  amountMin: string; // empty string = no filter
  amountMax: string; // empty string = no filter
  sortBy: "date" | "amount" | "created_at";
  sortDir: "asc" | "desc";
}

export const EMPTY_FILTERS: FilterState = {
  accountIds: [],
  categoryIds: [],
  tagIds: [],
  types: [],
  showExcluded: false,
  showSplitChildren: false,
  amountMin: "",
  amountMax: "",
  sortBy: "date",
  sortDir: "desc",
};

// ─── Nav items ───────────────────────────────────────────────────────────────

type NavId =
  | "account"
  | "type"
  | "status"
  | "amount"
  | "category"
  | "tag"
  | "sort";

type NavItem = {
  id: NavId;
  label: string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { id: "account", label: "Account", icon: Layers },
  { id: "type", label: "Type", icon: LayoutGrid },
  { id: "status", label: "Status", icon: Clock },
  { id: "amount", label: "Amount", icon: DollarSign },
  { id: "category", label: "Category", icon: Tag },
  { id: "tag", label: "Tag", icon: Hash },
  { id: "sort", label: "Sort", icon: ArrowUpDown },
];

const TYPE_OPTIONS: {
  value: "income" | "expense" | "transfer";
  label: string;
}[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function countActiveFilters(f: FilterState): number {
  return [
    f.accountIds.length > 0,
    f.categoryIds.length > 0,
    f.tagIds.length > 0,
    f.types.length > 0,
    f.showExcluded,
    f.showSplitChildren,
    f.amountMin !== "",
    f.amountMax !== "",
  ].filter(Boolean).length;
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function AccountPanel({
  draft,
  accounts,
  onChange,
}: {
  draft: FilterState;
  accounts: Account[];
  onChange: (d: FilterState) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search accounts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            No accounts found.
          </p>
        )}
        {filtered.map((a) => (
          <label
            key={a.id}
            className="flex items-center gap-2 text-sm cursor-pointer select-none py-0.5"
          >
            <Checkbox
              checked={draft.accountIds.includes(a.id)}
              onCheckedChange={() =>
                onChange({
                  ...draft,
                  accountIds: toggle(draft.accountIds, a.id),
                })
              }
            />
            {a.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function TypePanel({
  draft,
  onChange,
}: {
  draft: FilterState;
  onChange: (d: FilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {TYPE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 text-sm cursor-pointer select-none py-0.5"
        >
          <Checkbox
            checked={draft.types.includes(opt.value)}
            onCheckedChange={() =>
              onChange({ ...draft, types: toggle(draft.types, opt.value) })
            }
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function StatusPanel({
  draft,
  onChange,
}: {
  draft: FilterState;
  onChange: (d: FilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none py-0.5">
        <Checkbox
          checked={draft.showExcluded}
          onCheckedChange={(checked) =>
            onChange({ ...draft, showExcluded: checked === true })
          }
        />
        Show excluded
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none py-0.5">
        <Checkbox
          checked={draft.showSplitChildren}
          onCheckedChange={(checked) =>
            onChange({ ...draft, showSplitChildren: checked === true })
          }
        />
        Show split children
      </label>
    </div>
  );
}

function AmountPanel({
  draft,
  onChange,
}: {
  draft: FilterState;
  onChange: (d: FilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Min amount
        </label>
        <Input
          type="number"
          placeholder="0.00"
          value={draft.amountMin}
          onChange={(e) => onChange({ ...draft, amountMin: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Max amount
        </label>
        <Input
          type="number"
          placeholder="0.00"
          value={draft.amountMax}
          onChange={(e) => onChange({ ...draft, amountMax: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

function CategoryPanel({
  draft,
  categories,
  onChange,
}: {
  draft: FilterState;
  categories: Category[];
  onChange: (d: FilterState) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            No categories found.
          </p>
        )}
        {filtered.map((c) => {
          const isSelected = draft.categoryIds.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  categoryIds: toggle(draft.categoryIds, c.id),
                })
              }
              className={cn(
                "transition-opacity",
                isSelected ? "opacity-100" : "opacity-50 hover:opacity-75",
              )}
            >
              <CategoryPill
                name={c.name}
                icon={c.icon}
                color={c.color}
                size="sm"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagPanel({
  draft,
  tags,
  onChange,
}: {
  draft: FilterState;
  tags: TagType[];
  onChange: (d: FilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
      {tags.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No tags found.</p>
      )}
      {tags.map((t) => (
        <label
          key={t.id}
          className="flex items-center gap-2 text-sm cursor-pointer select-none py-0.5"
        >
          <Checkbox
            checked={draft.tagIds.includes(t.id)}
            onCheckedChange={() =>
              onChange({ ...draft, tagIds: toggle(draft.tagIds, t.id) })
            }
          />
          #{t.name}
        </label>
      ))}
    </div>
  );
}

const SORT_BY_OPTIONS: { value: FilterState["sortBy"]; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "created_at", label: "Created At" },
];

function SortPanel({
  draft,
  onChange,
}: {
  draft: FilterState;
  onChange: (d: FilterState) => void;
}) {
  const isAmount = draft.sortBy === "amount";
  const dirOptions = isAmount
    ? [
        { value: "desc" as const, label: "Highest first" },
        { value: "asc" as const, label: "Lowest first" },
      ]
    : [
        { value: "desc" as const, label: "Newest first" },
        { value: "asc" as const, label: "Oldest first" },
      ];

  return (
    <div className="flex flex-col gap-5">
      {/* Sort by */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Sort by
        </span>
        <div className="inline-flex rounded-md border overflow-hidden">
          {SORT_BY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...draft, sortBy: opt.value })}
              className={cn(
                "flex-1 px-3 py-1.5 text-sm transition-colors",
                draft.sortBy === opt.value
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background hover:bg-muted text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort direction */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Direction
        </span>
        <div className="inline-flex rounded-md border overflow-hidden">
          {dirOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...draft, sortDir: opt.value })}
              className={cn(
                "flex-1 px-3 py-1.5 text-sm transition-colors",
                draft.sortDir === opt.value
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background hover:bg-muted text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FilterPopoverProps {
  filters: FilterState;
  accounts: Account[];
  categories: Category[];
  tags: TagType[];
  onApply: (filters: FilterState) => void;
}

export function FilterPopover({
  filters,
  accounts,
  categories,
  tags,
  onApply,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(filters);
  const [activeNav, setActiveNav] = useState<NavId>("account");

  // Sync draft when popover opens
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(filters);
    setOpen(next);
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(filters);
    setOpen(false);
  };

  const activeFilterCount = countActiveFilters(filters);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <Filter className="size-4" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="secondary">{activeFilterCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="p-0 w-dvw md:w-130 h-100">
        <div className="flex h-full">
          {/* Left sidebar nav */}
          <nav className="flex flex-col w-36 shrink-0 border-r bg-muted/30 py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                    activeNav === item.id
                      ? "bg-background font-medium text-foreground border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right content area */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex-1 overflow-y-auto p-4">
              {activeNav === "account" && (
                <AccountPanel
                  draft={draft}
                  accounts={accounts}
                  onChange={setDraft}
                />
              )}
              {activeNav === "type" && (
                <TypePanel draft={draft} onChange={setDraft} />
              )}
              {activeNav === "status" && (
                <StatusPanel draft={draft} onChange={setDraft} />
              )}
              {activeNav === "amount" && (
                <AmountPanel draft={draft} onChange={setDraft} />
              )}
              {activeNav === "category" && (
                <CategoryPanel
                  draft={draft}
                  categories={categories}
                  onChange={setDraft}
                />
              )}
              {activeNav === "tag" && (
                <TagPanel draft={draft} tags={tags} onChange={setDraft} />
              )}
              {activeNav === "sort" && (
                <SortPanel draft={draft} onChange={setDraft} />
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
