# Transactions Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TransactionsPage with animated FundWidget stats, tab navigation (Transactions / Recurring / Debts), a panel-style FilterPopover, date-grouped table with row selection, and a floating BulkActionBar.

**Architecture:** FundWidget (provided motion/react code) wrapped by TransactionWidgets for real data → Tabs for Transactions/Recurring/Debts → custom GroupedTransactionTable replaces DataTable → BulkActionBar appears on selection. All new UI lives in `src/pages/transactions/` co-located files. Bulk mutations run sequential single-item calls (no backend bulk endpoint exists).

**Tech Stack:** React 19, TanStack Query v5, TanStack Table v8, motion/react (new dep), react-icons (new dep), Radix UI, nuqs, Tailwind CSS, Sonner toasts.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/transactions/FundWidget.tsx` | Create | Animated vertical-scroll card widget (exact code from spec) |
| `src/pages/transactions/TransactionWidgets.tsx` | Create | Fetches daily/weekly/monthly/all-time summaries, maps to FundItem[], renders FundWidget |
| `src/pages/transactions/FilterPopover.tsx` | Create | Panel-style filter popover (Account, Date, Type, Status, Amount, Category, Tag) |
| `src/pages/transactions/GroupedTransactionTable.tsx` | Create | Date-grouped custom table with per-row, per-group, and global checkboxes |
| `src/pages/transactions/BulkActionBar.tsx` | Create | Floating action bar with count, bulk edit dialog, bulk delete confirm |
| `src/hooks/use-transactions.ts` | Modify | Add `useBulkDeleteTransactions`, `useBulkUpdateTransactions` hooks |
| `src/pages/transactions/index.tsx` | Modify | Full rewrite: widgets, Tabs, FilterPopover, GroupedTransactionTable, BulkActionBar |
| `src/pages/transactions/DateNavBlock.tsx` | Keep as-is | No change needed |
| `src/pages/transactions/MultiSelectFilter.tsx` | Keep as-is | Reused internally by FilterPopover |

---

## Task 1: Install Dependencies

**Files:**
- No file changes, just `package.json` side-effect via npm

- [ ] **Step 1: Install motion and react-icons**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npm install motion react-icons
```

Expected: both packages appear in `node_modules/`, `package.json` updated.

- [ ] **Step 2: Verify imports resolve**

```bash
node -e "require('./node_modules/motion/dist/index.cjs')" && echo "motion OK"
node -e "require('./node_modules/react-icons/fa6/index.js')" && echo "react-icons OK"
```

Expected: both print OK with no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add motion and react-icons dependencies"
```

---

## Task 2: Create FundWidget.tsx

**Files:**
- Create: `src/pages/transactions/FundWidget.tsx`

- [ ] **Step 1: Write the file with exact provided code**

```tsx
import React, { useState } from 'react';
import {
  motion,
  MotionConfig,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  type Transition,
} from 'motion/react';
import { FaArrowUp } from 'react-icons/fa6';

export interface FundItem {
  id: string;
  label: string;
  value: string;
  change: string;
}

interface FundWidgetProps {
  data?: FundItem[];
  initialIndex?: number;
}

const DEFAULT_DATA: FundItem[] = [
  { id: 'daily', label: 'Today', value: '$0', change: '0%' },
  { id: 'weekly', label: 'This Week', value: '$0', change: '0%' },
  { id: 'monthly', label: 'This Month', value: '$0', change: '0%' },
  { id: 'alltime', label: 'All Time', value: '$0', change: '0%' },
];

const CARD_HEIGHT = 320;
const DRAG_BUFFER = 40;
const VELOCITY_THRESHOLD = 0;

const SPRING_OPTIONS: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 40,
};

const FundCard = ({ item, i, y }: { item: FundItem; i: number; y: ReturnType<typeof useMotionValue<number>> }) => {
  const cardOffset = i * CARD_HEIGHT;

  const rotateX = useTransform(
    y,
    [-(cardOffset + CARD_HEIGHT), -cardOffset, -(cardOffset - CARD_HEIGHT)],
    [-25, 0, 25],
    { clamp: true },
  );

  const DEAD_ZONE = CARD_HEIGHT * 0.25;

  const blur = useTransform(
    y,
    [
      -(cardOffset + CARD_HEIGHT),
      -(cardOffset + DEAD_ZONE),
      -cardOffset,
      -(cardOffset - DEAD_ZONE),
      -(cardOffset - CARD_HEIGHT),
    ],
    [8, 0, 0, 0, 8],
    { clamp: true },
  );

  const filter = useMotionTemplate`blur(${blur}px)`;

  return (
    <motion.div
      key={item.id}
      className="flex min-h-[320px] min-w-[320px] flex-col p-10 transform-3d"
      style={{ rotateX, filter, transformPerspective: 1000 }}
    >
      <h2 className="text-[60px] leading-none font-bold text-zinc-900 dark:text-zinc-100">
        {item.value}
      </h2>
      <p className="mt-4 flex items-center gap-2 text-[32px] font-bold text-stone-400 dark:text-stone-400">
        {item.change}
        <FaArrowUp className="text-2xl" />
      </p>
      <h3 className="mt-12 text-[40px] font-bold text-stone-600 dark:text-stone-200">
        {item.label}
      </h3>
    </motion.div>
  );
};

export const FundWidget: React.FC<FundWidgetProps> = ({
  data = DEFAULT_DATA,
  initialIndex = 0,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const y = useMotionValue(-(initialIndex * CARD_HEIGHT));

  const handleDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const offset = info.offset.y;
    const velocity = info.velocity.y;
    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      setIndex((prev) => Math.min(prev + 1, data.length - 1));
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      setIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <MotionConfig transition={SPRING_OPTIONS}>
        <div className="relative overflow-visible">
          <div className="relative z-0 overflow-visible">
            <div className="absolute right-[18px] -bottom-[332px] left-[18px] z-[-1] h-20 w-[90%] rounded-[44px] border-2 border-[#E0DEDA] bg-[#F2F1EC] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-zinc-800" />
          </div>
          <div className="relative h-[320px] w-[320px] overflow-hidden rounded-[48px] border-2 border-[#E0DEDA] bg-[#FBFCF9] shadow-md select-none perspective-[1000px] transform-3d dark:border-white/10 dark:bg-zinc-900">
            <motion.div
              drag="y"
              dragConstraints={{
                top: -((data.length - 1) * CARD_HEIGHT),
                bottom: 0,
              }}
              dragElastic={0.12}
              style={{ y }}
              onDragEnd={handleDragEnd}
              animate={{ y: -(index * CARD_HEIGHT) }}
              className="flex cursor-grab flex-col transform-3d active:cursor-grabbing"
            >
              {data.map((item, i) => (
                <FundCard key={item.id} item={item} i={i} y={y} />
              ))}
            </motion.div>
            <div className="absolute top-1/2 right-7 z-20 flex -translate-y-1/2 flex-col">
              {data.map((_, i) => (
                <button
                  key={i}
                  title="slider"
                  onClick={() => setIndex(i)}
                  className="py-1 focus:outline-none"
                >
                  <motion.div
                    animate={{
                      height: i === index ? 42 : 10,
                      backgroundColor: i === index ? '#585652' : '#D3D3D3',
                    }}
                    transition={{ duration: 0.3 }}
                    className="w-[8px] rounded-full"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </MotionConfig>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/FundWidget.tsx
git commit -m "feat: add FundWidget animated scroll card component"
```

---

## Task 3: Create TransactionWidgets.tsx

**Files:**
- Create: `src/pages/transactions/TransactionWidgets.tsx`

This component fetches 4 time-period summaries and renders FundWidget with real data.

- [ ] **Step 1: Compute date helpers and write the component**

```tsx
import { useTransactionSummary } from '@/hooks';
import { FundWidget, type FundItem } from './FundWidget';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatMoney(amount: number, symbol: string, decimals: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(abs / 1_000).toFixed(1)}K`;
  return `${symbol}${abs.toFixed(decimals)}`;
}

function changeLabel(current: number, previous: number): string {
  if (previous === 0) return current >= 0 ? '+∞%' : '-∞%';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

export function TransactionWidgets() {
  const today = todayISO();
  const weekStart = nDaysAgoISO(7);
  const prevWeekStart = nDaysAgoISO(14);
  const monthStart = startOfMonthISO();
  const prevMonthStart = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const prevMonthEnd = (() => {
    const d = new Date();
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  })();

  const { data: daily } = useTransactionSummary({ start_date: today, end_date: today });
  const { data: weekly } = useTransactionSummary({ start_date: weekStart, end_date: today });
  const { data: prevWeekly } = useTransactionSummary({ start_date: prevWeekStart, end_date: nDaysAgoISO(8) });
  const { data: monthly } = useTransactionSummary({ start_date: monthStart, end_date: today });
  const { data: prevMonthly } = useTransactionSummary({ start_date: prevMonthStart, end_date: prevMonthEnd });
  const { data: allTime } = useTransactionSummary();

  const symbol = daily?.currency ?? monthly?.currency ?? allTime?.currency ?? '$';
  const decimals = daily?.decimals ?? 2;

  const dailyBalance = (daily?.income ?? 0) - (daily?.expense ?? 0);
  const weeklyBalance = (weekly?.income ?? 0) - (weekly?.expense ?? 0);
  const prevWeeklyBalance = (prevWeekly?.income ?? 0) - (prevWeekly?.expense ?? 0);
  const monthlyBalance = (monthly?.income ?? 0) - (monthly?.expense ?? 0);
  const prevMonthlyBalance = (prevMonthly?.income ?? 0) - (prevMonthly?.expense ?? 0);
  const allTimeBalance = (allTime?.income ?? 0) - (allTime?.expense ?? 0);

  const items: FundItem[] = [
    {
      id: 'daily',
      label: 'Today',
      value: formatMoney(dailyBalance, symbol, decimals),
      change: changeLabel(dailyBalance, 0),
    },
    {
      id: 'weekly',
      label: 'This Week',
      value: formatMoney(weeklyBalance, symbol, decimals),
      change: changeLabel(weeklyBalance, prevWeeklyBalance),
    },
    {
      id: 'monthly',
      label: 'This Month',
      value: formatMoney(monthlyBalance, symbol, decimals),
      change: changeLabel(monthlyBalance, prevMonthlyBalance),
    },
    {
      id: 'alltime',
      label: 'All Time',
      value: formatMoney(allTimeBalance, symbol, decimals),
      change: changeLabel(allTimeBalance, 0),
    },
  ];

  return <FundWidget data={items} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/TransactionWidgets.tsx
git commit -m "feat: add TransactionWidgets with real daily/weekly/monthly/all-time summaries"
```

---

## Task 4: Create FilterPopover.tsx

**Files:**
- Create: `src/pages/transactions/FilterPopover.tsx`

Panel-style popover (left sidebar nav + right content area), matching screenshot 3. Filters: Account, Date, Type, Status, Amount, Category, Tag. Draft state applied only on "Apply".

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react';
import {
  Layers, Calendar, Tag, LayoutGrid, Clock, Hash, DollarSign, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { CategoryPill } from '@/components/shared';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/categories';
import type { Tag as TagType } from '@/types/tags';
import type { Account } from '@/types/accounts';

export interface FilterState {
  accountIds: string[];
  categoryIds: string[];
  tagIds: string[];
  types: string[];
  showExcluded: boolean;
  showSplitChildren: boolean;
  amountMin: string;
  amountMax: string;
}

export const EMPTY_FILTERS: FilterState = {
  accountIds: [],
  categoryIds: [],
  tagIds: [],
  types: [],
  showExcluded: false,
  showSplitChildren: false,
  amountMin: '',
  amountMax: '',
};

interface FilterPopoverProps {
  filters: FilterState;
  accounts: Account[];
  categories: Category[];
  tags: TagType[];
  onApply: (filters: FilterState) => void;
}

type FilterTab = 'account' | 'type' | 'status' | 'amount' | 'category' | 'tag';

const NAV_ITEMS: { id: FilterTab; label: string; icon: typeof Filter }[] = [
  { id: 'account', label: 'Account', icon: Layers },
  { id: 'type', label: 'Type', icon: LayoutGrid },
  { id: 'status', label: 'Status', icon: Clock },
  { id: 'amount', label: 'Amount', icon: DollarSign },
  { id: 'category', label: 'Category', icon: Tag },
  { id: 'tag', label: 'Tag', icon: Hash },
];

const TRANSACTION_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

function activeCount(f: FilterState): number {
  return [
    f.accountIds.length > 0,
    f.categoryIds.length > 0,
    f.tagIds.length > 0,
    f.types.length > 0,
    f.showExcluded,
    f.showSplitChildren,
    !!f.amountMin || !!f.amountMax,
  ].filter(Boolean).length;
}

export function FilterPopover({ filters, accounts, categories, tags, onApply }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(filters);
  const [activeTab, setActiveTab] = useState<FilterTab>('account');
  const [accountSearch, setAccountSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  const handleOpen = (o: boolean) => {
    if (o) setDraft(filters);
    setOpen(o);
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(filters);
    setOpen(false);
  };

  const toggle = <K extends 'accountIds' | 'categoryIds' | 'tagIds' | 'types'>(
    key: K,
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const count = activeCount(filters);

  const filteredAccounts = accounts.filter((a) =>
    a.name.toLowerCase().includes(accountSearch.toLowerCase()),
  );
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <Filter className="size-4" />
          Filter
          {count > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[520px] p-0 overflow-hidden"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <div className="flex h-[380px]">
          {/* Left nav */}
          <div className="w-40 border-r bg-muted/30 flex flex-col py-2 gap-0.5 shrink-0">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 text-sm rounded-md mx-1 transition-colors',
                  activeTab === id
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-background/60',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {activeTab === 'account' && (
                <>
                  <Input
                    placeholder="Filter accounts"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="mb-2 h-8 text-sm"
                  />
                  {filteredAccounts.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={draft.accountIds.includes(a.id)}
                        onCheckedChange={() => toggle('accountIds', a.id)}
                      />
                      <span className="text-sm">{a.name}</span>
                    </label>
                  ))}
                </>
              )}

              {activeTab === 'type' && TRANSACTION_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={draft.types.includes(t.value)}
                    onCheckedChange={() => toggle('types', t.value)}
                  />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}

              {activeTab === 'status' && (
                <>
                  <label className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={draft.showExcluded}
                      onCheckedChange={(v) =>
                        setDraft((p) => ({ ...p, showExcluded: !!v }))
                      }
                    />
                    <span className="text-sm">Show excluded</span>
                  </label>
                  <label className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={draft.showSplitChildren}
                      onCheckedChange={(v) =>
                        setDraft((p) => ({ ...p, showSplitChildren: !!v }))
                      }
                    />
                    <span className="text-sm">Show split children</span>
                  </label>
                </>
              )}

              {activeTab === 'amount' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Min amount</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={draft.amountMin}
                      onChange={(e) => setDraft((p) => ({ ...p, amountMin: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Max amount</label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={draft.amountMax}
                      onChange={(e) => setDraft((p) => ({ ...p, amountMax: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'category' && (
                <>
                  <Input
                    placeholder="Filter categories"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="mb-2 h-8 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredCategories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggle('categoryIds', c.id)}
                        className={cn(
                          'transition-opacity',
                          draft.categoryIds.includes(c.id)
                            ? 'opacity-100'
                            : 'opacity-40 hover:opacity-70',
                        )}
                      >
                        <CategoryPill name={c.name} icon={c.icon} color={c.color} size="sm" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'tag' && tags.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={draft.tagIds.includes(t.id)}
                    onCheckedChange={() => toggle('tagIds', t.id)}
                  />
                  <span className="text-sm">#{t.name}</span>
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t p-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/FilterPopover.tsx
git commit -m "feat: add panel-style FilterPopover with Account/Type/Status/Amount/Category/Tag panels"
```

---

## Task 5: Create GroupedTransactionTable.tsx

**Files:**
- Create: `src/pages/transactions/GroupedTransactionTable.tsx`

Custom date-grouped table. No TanStack Table — pure div-based layout matching the screenshot layout exactly.

Columns: [checkbox | TRANSACTION | CATEGORY LABEL | AMOUNT | actions]

Date group header row: [group-checkbox | DATE · COUNT | (empty) | total amount | (empty)]

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Link2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CategoryPill } from '@/components/shared';
import { AmountText } from '@/components/shared/AmountText';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types';
import { TransactionActionMenu } from './TransactionActionMenu';

interface GroupedTransactionTableProps {
  transactions: Transaction[];
  selectedIds: Set<string>;
  onSelectId: (id: string, checked: boolean) => void;
  onSelectGroup: (ids: string[], checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

interface DateGroup {
  date: string;
  label: string;
  transactions: Transaction[];
  total: number;
  currency: string;
  decimals: number;
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();
}

function groupByDate(transactions: Transaction[]): DateGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const existing = map.get(t.date) ?? [];
    existing.push(t);
    map.set(t.date, existing);
  }
  return Array.from(map.entries()).map(([date, txns]) => {
    const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const ref = txns[0];
    return {
      date,
      label: formatGroupDate(date),
      transactions: txns,
      total: income - expense,
      currency: ref?.account.currency?.symbol ?? '',
      decimals: ref?.account.currency?.decimals ?? 2,
    };
  });
}

export function GroupedTransactionTable({
  transactions,
  selectedIds,
  onSelectId,
  onSelectGroup,
  onSelectAll,
  onDelete,
  onDuplicate,
}: GroupedTransactionTableProps) {
  const navigate = useNavigate();

  const groups = useMemo(() => groupByDate(transactions), [transactions]);

  const selectableIds = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income' || t.type === 'expense')
        .map((t) => t.id),
    [transactions],
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectableIds.some((id) => selectedIds.has(id));

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No transactions found
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Global header */}
      <div className="grid grid-cols-[40px_1fr_180px_140px_48px] items-center px-4 py-2.5 bg-muted/40 border-b text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
            onCheckedChange={(v) => onSelectAll(!!v)}
          />
        </div>
        <span>Transaction</span>
        <span>Category Label</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      {/* Date groups */}
      {groups.map((group) => {
        const groupSelectableIds = group.transactions
          .filter((t) => t.type === 'income' || t.type === 'expense')
          .map((t) => t.id);
        const groupAllSelected =
          groupSelectableIds.length > 0 &&
          groupSelectableIds.every((id) => selectedIds.has(id));
        const groupSomeSelected = groupSelectableIds.some((id) => selectedIds.has(id));

        return (
          <div key={group.date}>
            {/* Group header */}
            <div className="grid grid-cols-[40px_1fr_180px_140px_48px] items-center px-4 py-2 bg-muted/20 border-b">
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={groupAllSelected}
                  data-state={
                    groupSomeSelected && !groupAllSelected ? 'indeterminate' : undefined
                  }
                  onCheckedChange={(v) => onSelectGroup(groupSelectableIds, !!v)}
                />
              </div>
              <span className="text-sm font-semibold text-foreground/80">
                {group.label}
                <span className="ml-2 font-normal text-muted-foreground">
                  · {group.transactions.length}
                </span>
              </span>
              <span />
              <span className="text-right text-sm font-mono font-medium text-muted-foreground">
                <AmountText
                  value={group.total}
                  decimals={group.decimals}
                  currency={group.currency}
                  signDisplay="always"
                />
              </span>
              <span />
            </div>

            {/* Transaction rows */}
            {group.transactions.map((t) => {
              const isSelected = selectedIds.has(t.id);
              const isIncome = t.type === 'income';
              const isTransfer = t.type === 'transfer';
              const isSelectable = t.type !== 'transfer';

              const mainDescription =
                t.description ||
                (t.type === 'transfer'
                  ? `${t.account.name} → ${t.toAccount?.name}`
                  : t.category?.name ?? '—');

              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/transactions/${t.id}`)}
                  className={cn(
                    'grid grid-cols-[40px_1fr_180px_140px_48px] items-center px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors',
                    isSelected && 'bg-primary/5',
                    t.isExcluded && 'opacity-60',
                  )}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    {isSelectable ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => onSelectId(t.id, !!v)}
                      />
                    ) : (
                      <span />
                    )}
                  </div>

                  {/* Transaction cell */}
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-sm truncate">
                      {/* Avatar */}
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground uppercase">
                        {mainDescription.charAt(0)}
                      </span>
                      <span className="truncate">{mainDescription}</span>
                      {t.linkedTransactionId && <Link2 className="size-3.5 text-muted-foreground shrink-0" />}
                      {!t.isApproved && <span className="text-amber-500 text-xs" title="Pending">⏳</span>}
                      {t.isExcluded && <span className="text-xs text-muted-foreground" title="Excluded">⊘</span>}
                      {t.recurringId && <span className="text-xs text-muted-foreground" title="Recurring">↻</span>}
                      {t.debtId && <span className="text-xs text-muted-foreground" title="Debt">$</span>}
                    </div>
                    <div className="text-xs text-muted-foreground pl-[2.375rem] truncate">
                      {t.account.name}
                    </div>
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex gap-1 pl-[2.375rem] flex-wrap">
                        {t.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="text-xs bg-muted rounded px-1 text-muted-foreground"
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category cell */}
                  <div>
                    {t.category ? (
                      <CategoryPill
                        name={t.category.name}
                        icon={t.category.icon}
                        color={t.category.color}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>

                  {/* Amount cell */}
                  <div className="text-right flex items-center justify-end gap-1.5">
                    {!t.isApproved && <Lock className="size-3.5 text-muted-foreground" />}
                    <span
                      className={cn(
                        'font-mono font-semibold text-sm',
                        isIncome
                          ? 'text-green-600'
                          : isTransfer
                          ? 'text-blue-500'
                          : 'text-red-500',
                      )}
                    >
                      <AmountText
                        value={isIncome ? t.amount : -t.amount}
                        decimals={t.account.currency?.decimals ?? 2}
                        currency={t.account.currency?.symbol}
                        signDisplay="always"
                      />
                    </span>
                  </div>

                  {/* Actions cell */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <TransactionActionMenu
                      transaction={t}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create TransactionActionMenu.tsx** (extracted from columns.tsx to avoid duplication)

Create `src/pages/transactions/TransactionActionMenu.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { MoreHorizontal, Pencil, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Transaction } from '@/types';

interface TransactionActionMenuProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function TransactionActionMenu({ transaction, onDelete, onDuplicate }: TransactionActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/transactions/${transaction.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(transaction.id)}>
          <Copy className="mr-2 size-4" />
          Duplicate
        </DropdownMenuItem>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this transaction.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(transaction.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/transactions/GroupedTransactionTable.tsx src/pages/transactions/TransactionActionMenu.tsx
git commit -m "feat: add GroupedTransactionTable with date groups and row selection"
```

---

## Task 6: Create BulkActionBar.tsx

**Files:**
- Create: `src/pages/transactions/BulkActionBar.tsx`

Floating bottom-center bar. Shows when selectedIds.size > 0. Has: indeterminate checkbox + "N transactions selected" + edit icon (opens bulk-edit dialog) + delete icon (with confirm).

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { CategorySelect } from '@/components/shared';
import type { Category } from '@/types/categories';

interface BulkEditValues {
  categoryId?: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  categories: Category[];
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkEdit: (values: BulkEditValues) => void;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  categories,
  onClearSelection,
  onBulkDelete,
  onBulkEdit,
}: BulkActionBarProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string>('');

  if (selectedCount === 0) return null;

  const handleEditApply = () => {
    if (editCategoryId) {
      onBulkEdit({ categoryId: editCategoryId });
    }
    setEditOpen(false);
    setEditCategoryId('');
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-background shadow-lg px-4 py-2.5">
        <Checkbox
          checked={selectedCount === totalCount}
          data-state={selectedCount < totalCount ? 'indeterminate' : 'checked'}
          onCheckedChange={() => onClearSelection()}
          className="rounded-sm"
        />
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditOpen(true)}
          title="Bulk edit"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDeleteOpen(true)}
          title="Delete selected"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected transactions will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onBulkDelete(); setDeleteOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedCount} transactions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {selectedCount} transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Change category</label>
              <CategorySelect
                categories={categories}
                value={editCategoryId}
                onChange={setEditCategoryId}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditApply} disabled={!editCategoryId}>
              Apply to {selectedCount} transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/BulkActionBar.tsx
git commit -m "feat: add BulkActionBar with floating selection UI and bulk edit/delete dialogs"
```

---

## Task 7: Add Bulk Mutation Hooks

**Files:**
- Modify: `src/hooks/use-transactions.ts`

Add `useBulkDeleteTransactions` and `useBulkUpdateTransactions`. No bulk API endpoint — run sequential single-item mutations, invalidate once at end.

- [ ] **Step 1: Read current end of use-transactions.ts to find insertion point**

Read `src/hooks/use-transactions.ts` from line 160 onward to see where to append.

- [ ] **Step 2: Append the two bulk hooks after useUnlinkCounterpart**

At the end of `src/hooks/use-transactions.ts`, add:

```ts
export function useBulkDeleteTransactions() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (ids: string[]) => {
            for (const id of ids) {
                await transactionsApi.delete(id)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transactions deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete transactions')
        },
    })
}

export function useBulkUpdateTransactions() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ ids, data }: { ids: string[]; data: { category_id?: string } }) => {
            for (const id of ids) {
                await transactionsApi.update(id, data as any)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
            toast.success('Transactions updated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update transactions')
        },
    })
}
```

- [ ] **Step 3: Export from hooks/index.ts**

Check `src/hooks/index.ts` to see if it exports everything from `use-transactions.ts`. If yes, the new hooks are auto-exported. If it lists individually, add:
```ts
export { useBulkDeleteTransactions, useBulkUpdateTransactions } from './use-transactions'
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-transactions.ts src/hooks/index.ts
git commit -m "feat: add useBulkDeleteTransactions and useBulkUpdateTransactions hooks"
```

---

## Task 8: Rewrite TransactionsPage index.tsx

**Files:**
- Modify: `src/pages/transactions/index.tsx`

Full rewrite with the new layout:
1. PageHeader (title "Transactions", Import + New transaction buttons)
2. FundWidget area (TransactionWidgets)
3. Tabs: Transactions | Recurring | Debts
4. In Transactions tab:
   - Search input + FilterPopover
   - GroupedTransactionTable
   - ServerPagination
   - BulkActionBar
5. Recurring tab: inline RecurringPage content
6. Debts tab: inline DebtsPage content

- [ ] **Step 1: Check how RecurringPage and DebtsPage are structured for inline embedding**

Read the full `src/pages/recurring/index.tsx` and first 80 lines of `src/pages/debts/index.tsx` to understand what they render inside.

- [ ] **Step 2: Check CategorySelect component exists**

```bash
grep -n "CategorySelect" /Users/ergiasllani/CREATIONS/xpp/src/components/shared/index.ts
```

If it doesn't exist in shared, check `src/components/shared/CategorySelect.tsx`. If missing, plan to use a plain Select with categories list in BulkActionBar instead.

- [ ] **Step 3: Write the new index.tsx**

```tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  parseAsInteger, parseAsString, parseAsArrayOf, parseAsStringLiteral, parseAsBoolean,
  useQueryStates,
} from 'nuqs';
import { Search, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Page, PageHeader, ServerPagination } from '@/components/shared';
import {
  useTransactions, useDeleteTransaction, useDuplicateTransaction,
  useCategories, useTags, useAccounts,
  useBulkDeleteTransactions, useBulkUpdateTransactions,
} from '@/hooks';
import {
  TransactionWidgets,
} from './TransactionWidgets';
import { FilterPopover, EMPTY_FILTERS, type FilterState } from './FilterPopover';
import { GroupedTransactionTable } from './GroupedTransactionTable';
import { BulkActionBar } from './BulkActionBar';
import {
  firstDayOfCurrentMonth, getDateRange, stepMonth, stepDay,
} from './dateNavHelpers';
import RecurringPage from '@/pages/recurring';
import DebtsPage from '@/pages/debts';

const transactionSearchParams = {
  sortBy: parseAsStringLiteral(['date', 'amount', 'created_at'] as const).withDefault('date'),
  sortDir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault('desc'),
  page: parseAsInteger.withDefault(1),
  categoryIds: parseAsArrayOf(parseAsString).withDefault([]),
  tagIds: parseAsArrayOf(parseAsString).withDefault([]),
  accountIds: parseAsArrayOf(parseAsString).withDefault([]),
  types: parseAsArrayOf(parseAsString).withDefault([]),
  showExcluded: parseAsBoolean.withDefault(false),
  showSplitChildren: parseAsBoolean.withDefault(false),
  navDate: parseAsString.withDefault(firstDayOfCurrentMonth()),
  amountMin: parseAsString.withDefault(''),
  amountMax: parseAsString.withDefault(''),
};

const PER_PAGE = 20;

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useQueryStates(transactionSearchParams);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const monthDateRange = getDateRange('month', params.navDate);

  const hasCategoryFilter = params.categoryIds.length > 0;
  const fetchFilters = {
    per_page: 9999,
    page: 1,
    sort_by: params.sortBy,
    sort_direction: params.sortDir,
    start_date: monthDateRange.start_date,
    end_date: monthDateRange.end_date,
    include_excluded: params.showExcluded,
    include_split_children: params.showSplitChildren || hasCategoryFilter,
  };

  const { data, isLoading } = useTransactions(fetchFilters);
  const deleteTransaction = useDeleteTransaction();
  const duplicateTransaction = useDuplicateTransaction();
  const bulkDelete = useBulkDeleteTransactions();
  const bulkUpdate = useBulkUpdateTransactions();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: accountsData } = useAccounts({ active: true });
  const accounts = accountsData ?? [];

  const allMonthTxns = data?.data ?? [];

  // Apply filters
  let filtered = allMonthTxns;
  if (params.types.length > 0)
    filtered = filtered.filter((t) => params.types.includes(t.type));
  if (params.accountIds.length > 0)
    filtered = filtered.filter((t) => params.accountIds.includes(t.account.id));
  if (params.categoryIds.length > 0) {
    const parentIdsWithChildren = new Set<string>();
    for (const t of filtered) {
      if (!t.parentId && t.children && t.children.length > 0)
        parentIdsWithChildren.add(t.id);
    }
    filtered = filtered.filter(
      (t) =>
        !parentIdsWithChildren.has(t.id) &&
        t.category &&
        params.categoryIds.includes(t.category.id),
    );
  }
  if (params.tagIds.length > 0)
    filtered = filtered.filter((t) => t.tags.some((tag) => params.tagIds.includes(tag.id)));
  if (params.amountMin)
    filtered = filtered.filter((t) => t.amount >= Number(params.amountMin));
  if (params.amountMax)
    filtered = filtered.filter((t) => t.amount <= Number(params.amountMax));
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (t) =>
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.account.name ?? '').toLowerCase().includes(q) ||
        (t.category?.name ?? '').toLowerCase().includes(q),
    );
  }

  const totalCount = filtered.length;
  const currentPage = params.page;
  const transactions = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const meta =
    totalCount > 0
      ? {
          current_page: currentPage,
          last_page: Math.ceil(totalCount / PER_PAGE),
          per_page: PER_PAGE,
          total: totalCount,
          from: (currentPage - 1) * PER_PAGE + 1,
          to: Math.min(currentPage * PER_PAGE, totalCount),
        }
      : undefined;

  // Selection handlers
  const handleSelectId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectGroup = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const ids = transactions
          .filter((t) => t.type === 'income' || t.type === 'expense')
          .map((t) => t.id);
        setSelectedIds(new Set(ids));
      } else {
        setSelectedIds(new Set());
      }
    },
    [transactions],
  );

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkEdit = ({ categoryId }: { categoryId?: string }) => {
    if (!categoryId) return;
    bulkUpdate.mutate(
      { ids: Array.from(selectedIds), data: { category_id: categoryId } },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  };

  // Filter state
  const currentFilters: FilterState = {
    accountIds: params.accountIds,
    categoryIds: params.categoryIds,
    tagIds: params.tagIds,
    types: params.types,
    showExcluded: params.showExcluded,
    showSplitChildren: params.showSplitChildren,
    amountMin: params.amountMin,
    amountMax: params.amountMax,
  };

  const handleApplyFilters = (f: FilterState) => {
    setParams({
      accountIds: f.accountIds.length ? f.accountIds : null,
      categoryIds: f.categoryIds.length ? f.categoryIds : null,
      tagIds: f.tagIds.length ? f.tagIds : null,
      types: f.types.length ? f.types : null,
      showExcluded: f.showExcluded || null,
      showSplitChildren: f.showSplitChildren || null,
      amountMin: f.amountMin || null,
      amountMax: f.amountMax || null,
      page: 1,
    });
  };

  return (
    <Page title="Transactions">
      <PageHeader
        title="Transactions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="size-4 mr-2" />
              Import
            </Button>
            <Button size="sm" onClick={() => navigate('/transactions/create')}>
              <Plus className="size-4 mr-2" />
              New transaction
            </Button>
          </div>
        }
      />

      {/* Widgets */}
      <div className="flex justify-center mb-8">
        <TransactionWidgets />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList className="mb-4">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="debts">Debts</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          {/* Search + Filter row */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions ..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setParams({ page: 1 }); }}
                className="pl-9 h-10"
              />
            </div>
            <FilterPopover
              filters={currentFilters}
              accounts={accounts}
              categories={categories ?? []}
              tags={tags ?? []}
              onApply={handleApplyFilters}
            />
          </div>

          {/* Grouped table */}
          <GroupedTransactionTable
            transactions={transactions}
            selectedIds={selectedIds}
            onSelectId={handleSelectId}
            onSelectGroup={handleSelectGroup}
            onSelectAll={handleSelectAll}
            onDelete={(id) => deleteTransaction.mutate(id)}
            onDuplicate={(id) => duplicateTransaction.mutate(id)}
          />

          {/* Pagination */}
          {meta && (
            <div className="mt-4">
              <ServerPagination
                meta={meta}
                onPageChange={(page) => setParams({ page })}
                infoLabel="transactions"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringPage />
        </TabsContent>

        <TabsContent value="debts">
          <DebtsPage />
        </TabsContent>
      </Tabs>

      {/* Floating bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={transactions.filter((t) => t.type !== 'transfer').length}
        categories={categories ?? []}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkEdit={handleBulkEdit}
      />
    </Page>
  );
}
```

- [ ] **Step 4: Verify PageHeader accepts `actions` prop**

```bash
grep -n "actions\|createLink\|createLabel" /Users/ergiasllani/CREATIONS/xpp/src/components/shared/PageHeader.tsx
```

If `PageHeader` does NOT have an `actions` prop, use the existing `createLink`/`createLabel` pattern and add the Import button separately in the layout.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npx tsc --noEmit 2>&1 | head -50
```

Fix any type errors found. Common issues:
- `data-state="indeterminate"` on Checkbox → use the Radix `indeterminate` boolean prop instead
- `CategorySelect` not exported from shared → use a plain `<Select>` with categories as options
- `PageHeader` props mismatch → adjust to existing interface

- [ ] **Step 6: Commit**

```bash
git add src/pages/transactions/index.tsx
git commit -m "feat: redesign TransactionsPage with widgets, tabs, grouped table, and bulk actions"
```

---

## Task 9: Fix Checkbox Indeterminate State

**Files:**
- Modify: `src/components/ui/checkbox.tsx` (if needed)

The shadcn Checkbox uses Radix which supports `checked="indeterminate"`. Verify the component passes it through, and update GroupedTransactionTable and BulkActionBar to use `checked="indeterminate"` (Radix-style) rather than `data-state`.

- [ ] **Step 1: Read checkbox.tsx**

Read `src/components/ui/checkbox.tsx` to see how it wraps Radix.

- [ ] **Step 2: Update GroupedTransactionTable and BulkActionBar to use proper indeterminate**

Replace this pattern:
```tsx
<Checkbox
  checked={someSelected && !allSelected}
  data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
  onCheckedChange={...}
/>
```

With Radix-correct pattern:
```tsx
<Checkbox
  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
  onCheckedChange={...}
/>
```

Apply this fix in both `GroupedTransactionTable.tsx` (global header + group headers) and `BulkActionBar.tsx`.

- [ ] **Step 3: TypeScript check again**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/transactions/GroupedTransactionTable.tsx src/pages/transactions/BulkActionBar.tsx
git commit -m "fix: use correct Radix indeterminate checked state for group/global checkboxes"
```

---

## Self-Review

**Spec coverage:**
- ✅ Widgets at top (TransactionWidgets with FundWidget)
- ✅ Tab group: Transactions / Recurring / Debts
- ✅ Search + Filter button with panel popover
- ✅ Filter popover: Account, Date, Type, Status, Amount, Category, Tag panels
- ✅ Table header: checkbox + TRANSACTION + CATEGORY LABEL + AMOUNT
- ✅ Date-grouped subtables with group checkbox, date + count, total amount
- ✅ Category separated into its own column
- ✅ Action menu preserved after Amount column
- ✅ Row selection with checkboxes
- ✅ Bulk action bar with count, edit, delete
- ✅ FundWidget using exact provided motion/react code

**Gaps / decisions noted:**
- `Date` filter in FilterPopover: spec shows Date in the left nav but the current page uses month navigation (DateNavBlock). The FilterPopover Date panel is not implemented in Task 4 — add a date range start/end input to the FilterPopover if needed, or keep the existing DateNavBlock above the tabs.
- `Merchant` filter: no merchant field in Transaction type. Omitted.
- RecurringPage and DebtsPage rendered as tab content may include their own `<Page>` wrapper — if they look doubled, extract their inner content components.

**Placeholder scan:** None found — all tasks have concrete code.

**Type consistency:**
- `FilterState` defined in FilterPopover.tsx, imported in index.tsx ✅
- `FundItem` defined in FundWidget.tsx, used in TransactionWidgets.tsx ✅
- `useBulkDeleteTransactions(ids: string[])` matches call in index.tsx ✅
- `useBulkUpdateTransactions({ ids, data })` matches call in index.tsx ✅

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-18-transactions-page-redesign.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans skill

Which approach?
