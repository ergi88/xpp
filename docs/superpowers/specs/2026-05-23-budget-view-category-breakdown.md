# Budget View — Category Breakdown & Filter

**Date:** 2026-05-23  
**Status:** Approved

---

## Goal

Enhance `src/pages/budgets/[id]/index.tsx` with three visual features:
1. Apple storage–style segmented progress bar (colored by category)
2. Per-category amount breakdown rows below the bar
3. Category filter chips above the transaction list

---

## Architecture

All changes are self-contained in `src/pages/budgets/[id]/index.tsx`. No new files, no new hooks. Data is derived via `useMemo` from the already-available `transactions` array.

---

## Feature 1: Segmented Progress Bar

Replace the shadcn `<Progress>` component with a custom flex-row div.

**Rendering:**
- One segment per category that has transactions in the period
- Segments sorted by amount descending (largest first)
- Segment width = `(amount / budget.amount) * 100%`, clamped so total never exceeds 100%
- `background-color` = `category.color` (inline style — user-defined hex)
- Rounded ends: first child `rounded-l-full`, last child `rounded-r-full`, all `rounded-full` if only one
- Remaining space = `Math.max(0, 100 - totalPercent)%` filled with `bg-muted`
- If exceeded (`progress.is_exceeded`): segments fill up to 100%, bar has a red ring `ring-1 ring-red-500`

**Height:** `h-4` (slightly taller than the old `h-3` to accommodate segment colors)

**Hover tooltip (optional, skip for now):** Not in scope.

---

## Feature 2: Category Breakdown Rows

Rendered inside the progress card, below the segmented bar.

**One row per category** (same order as segments, descending by amount):
```
[color dot]  Food          $420    38%
[color dot]  Transport     $180    16%
             Remaining     $510    46%   ← muted, no dot, green text
```
Or if exceeded:
```
             Exceeded by   $90         ← red text
```

**Row anatomy:**
- 10px color dot (`rounded-full`, `background-color: category.color`, inline style)
- Category name (text-sm)
- Amount right-aligned (font-mono, text-sm)
- Percent right-aligned (text-xs, text-muted-foreground)

**Remaining row:** always shown at bottom, no dot, muted foreground. Green tint if not exceeded, red if exceeded.

**"Uncategorized" bucket:** transactions with `t.category === null` are grouped under "Uncategorized" with color `#94a3b8` (slate-400).

---

## Feature 3: Category Filter Chips

Rendered above the transactions list, below the progress card.

**Chips:**
- `All` pill (default selected)
- One pill per category that appears in `categoryTotals` (same order: amount desc)
- Active chip: `bg` set to `category.color` with `text-white`; inactive: `variant="outline"`
- Clicking active chip deselects (returns to "All")

**Interaction:**
- `selectedCategoryId: string | null` state (null = All)
- Filtered transactions = `selectedCategoryId ? transactions.filter(t => t.category?.id === selectedCategoryId) : transactions`
- Transaction count in section header reflects the filtered count

**Bar interaction:**
- When a category chip is selected, other segments in the bar dim to `opacity-40`
- Selected segment stays full opacity
- "All" = all segments full opacity

---

## Data Computation

```ts
const categoryTotals = useMemo(() => {
  const map = new Map<string, { category: Category; amount: number }>()
  for (const t of transactions) {
    const catId = t.category?.id ?? '__none__'
    const cat = t.category ?? { id: '__none__', name: 'Uncategorized', color: '#94a3b8', icon: 'circle', type: 'expense' as const }
    const entry = map.get(catId) ?? { category: cat, amount: 0 }
    entry.amount += t.amount
    map.set(catId, entry)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}, [transactions])
```

Segments: for each entry, `segmentPercent = Math.min(entry.amount / budget.amount * 100, remainingPercent)`.

---

## State

Add to existing component state:
```ts
const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
```

Reset `selectedCategoryId` to `null` when `offset` changes (via `useEffect` on `offset`).

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/budgets/[id]/index.tsx` | Add segmented bar, breakdown rows, filter chips |

---

## Out of Scope

- Tooltip on hover of bar segments
- Clicking a bar segment to filter (filter is only via chips)
- Animations / transitions on segment resize
- Categories with 0 transactions hidden (already the case — only categories with transactions appear)
