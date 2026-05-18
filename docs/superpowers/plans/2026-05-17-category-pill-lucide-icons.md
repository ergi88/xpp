# Category Pill + Lucide Icon Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace emoji category display app-wide with a styled pill (color border + 10% bg + colored icon/text), and replace the emoji picker with a searchable Lucide icon picker that stores icon names.

**Architecture:** Create `CategoryIcon` (dynamic Lucide renderer) and `CategoryPill` (shared pill component), then replace all ad-hoc `backgroundColor + emoji` render patterns across 11 files with `<CategoryPill>`. Add `LucideIconPicker` component and wire it into the category form.

**Tech Stack:** React, TypeScript, lucide-react (already installed v0.562.0), Tailwind CSS, Vitest

---

## File Map

**Create:**
- `src/lib/category-icon.tsx` — resolves Lucide icon component by name string
- `src/components/shared/CategoryPill.tsx` — pill UI component
- `src/components/features/categories/LucideIconPicker.tsx` — curated icon grid with search

**Modify:**
- `src/components/features/categories/IconPicker.tsx` — swap EmojiPicker → LucideIconPicker
- `src/components/features/categories/CategoryPreview.tsx` — use CategoryPill
- `src/components/features/categories/CategoryForm.tsx` — pass color to IconPicker
- `src/components/features/categories/columns.tsx` — use CategoryPill
- `src/components/shared/CategorySelect.tsx` — use CategoryPill
- `src/components/features/budgets/BudgetForm.tsx` — use CategoryPill
- `src/components/features/recurring/columns.tsx` — use CategoryPill
- `src/components/features/transactions/columns.tsx` — fix inline emoji display
- `src/pages/dashboard.tsx` — use CategoryIcon (icon-only context, not full pill)
- `src/pages/transactions/index.tsx` — use CategoryPill for filter chips
- `src/pages/reports/components/TopIncome.tsx` — use CategoryIcon
- `src/pages/reports/components/TopExpenses.tsx` — use CategoryIcon
- `src/pages/reports/components/ExpensesByCategory.tsx` — use CategoryIcon

---

## Task 1: `CategoryIcon` utility

**Files:**
- Create: `src/lib/category-icon.tsx`
- Create: `src/lib/__tests__/category-icon.test.tsx`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/category-icon.test.tsx
import { describe, it, expect } from 'vitest'
import { getCategoryIconComponent } from '@/lib/category-icon'
import { Tag, ShoppingCart } from 'lucide-react'

describe('getCategoryIconComponent', () => {
  it('returns ShoppingCart for "ShoppingCart"', () => {
    expect(getCategoryIconComponent('ShoppingCart')).toBe(ShoppingCart)
  })
  it('returns Tag for unknown/emoji values', () => {
    expect(getCategoryIconComponent('🏠')).toBe(Tag)
    expect(getCategoryIconComponent('NotAReal')).toBe(Tag)
    expect(getCategoryIconComponent('')).toBe(Tag)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npx vitest run src/lib/__tests__/category-icon.test.tsx
```
Expected: FAIL — `getCategoryIconComponent` not found

- [ ] **Step 3: Implement**

```tsx
// src/lib/category-icon.tsx
import * as LucideIcons from 'lucide-react'
import { LucideIcon, Tag } from 'lucide-react'

export function getCategoryIconComponent(name: string): LucideIcon {
  if (!name || !(name in LucideIcons)) return Tag
  return (LucideIcons as Record<string, unknown>)[name] as LucideIcon
}

interface CategoryIconProps {
  name: string
  size?: number
  className?: string
}

export function CategoryIcon({ name, size = 14, className }: CategoryIconProps) {
  const Icon = getCategoryIconComponent(name)
  return <Icon size={size} className={className} />
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npx vitest run src/lib/__tests__/category-icon.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/category-icon.tsx src/lib/__tests__/category-icon.test.tsx
git commit -m "feat: add CategoryIcon utility for dynamic Lucide icon rendering"
```

---

## Task 2: `CategoryPill` component

**Files:**
- Create: `src/components/shared/CategoryPill.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shared/CategoryPill.tsx
import { CategoryIcon } from '@/lib/category-icon'

interface CategoryPillProps {
  name: string
  icon: string
  color: string
  size?: 'sm' | 'md'
}

export function CategoryPill({ name, icon, color, size = 'md' }: CategoryPillProps) {
  const isSm = size === 'sm'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        isSm ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
      style={{
        borderColor: color,
        backgroundColor: `${color}1a`,
        color,
      }}
    >
      <CategoryIcon name={icon} size={isSm ? 12 : 14} />
      {name}
    </span>
  )
}
```

- [ ] **Step 2: Export from shared barrel**

Open `src/components/shared/index.ts` (or wherever shared components are exported). Add:
```ts
export { CategoryPill } from './CategoryPill'
```

> Note: find the barrel with `grep -r "CategorySelect" src/components/shared/`

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/CategoryPill.tsx
git commit -m "feat: add CategoryPill shared component"
```

---

## Task 3: `LucideIconPicker` component

**Files:**
- Create: `src/components/features/categories/LucideIconPicker.tsx`

- [ ] **Step 1: Create the curated icon list and picker**

```tsx
// src/components/features/categories/LucideIconPicker.tsx
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { getCategoryIconComponent } from '@/lib/category-icon'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const CURATED_ICONS: { group: string; icons: string[] }[] = [
  {
    group: 'Money',
    icons: ['Wallet', 'CreditCard', 'Banknote', 'PiggyBank', 'TrendingUp', 'TrendingDown', 'DollarSign', 'Coins', 'Receipt', 'HandCoins'],
  },
  {
    group: 'Food & Drink',
    icons: ['UtensilsCrossed', 'Coffee', 'Pizza', 'ShoppingBasket', 'Wine', 'Beer', 'IceCream', 'Sandwich', 'Apple', 'Beef'],
  },
  {
    group: 'Shopping',
    icons: ['ShoppingCart', 'ShoppingBag', 'Store', 'Tag', 'Gift', 'Package', 'Shirt', 'Gem', 'Watch', 'Glasses'],
  },
  {
    group: 'Health',
    icons: ['Heart', 'Activity', 'Pill', 'Stethoscope', 'Dumbbell', 'Brain', 'Eye', 'Thermometer', 'Hospital', 'Baby'],
  },
  {
    group: 'Travel',
    icons: ['Plane', 'Car', 'Train', 'Bus', 'Bike', 'Ship', 'Map', 'Hotel', 'Luggage', 'Fuel'],
  },
  {
    group: 'Home',
    icons: ['House', 'Sofa', 'Lightbulb', 'Tv', 'WashingMachine', 'Wrench', 'Trash2', 'Flame', 'Droplets', 'Key'],
  },
  {
    group: 'Work',
    icons: ['Briefcase', 'Laptop', 'Phone', 'Printer', 'BookOpen', 'PenLine', 'FolderOpen', 'Building2', 'GraduationCap', 'Hammer'],
  },
  {
    group: 'Entertainment',
    icons: ['Music', 'Gamepad2', 'Clapperboard', 'Camera', 'Book', 'Headphones', 'Ticket', 'Palette', 'Trophy', 'Dice5'],
  },
]

const ALL_ICONS = CURATED_ICONS.flatMap((g) => g.icons)

interface LucideIconPickerProps {
  value: string
  onChange: (value: string) => void
  color?: string
}

export function LucideIconPicker({ value, onChange, color = '#6366f1' }: LucideIconPickerProps) {
  const [search, setSearch] = useState('')

  const filteredGroups = search.trim()
    ? [{ group: 'Results', icons: ALL_ICONS.filter((n) => n.toLowerCase().includes(search.toLowerCase())) }]
    : CURATED_ICONS

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
        {filteredGroups.map((group) => (
          <div key={group.group}>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{group.group}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.icons.map((iconName) => {
                const Icon = getCategoryIconComponent(iconName)
                const isSelected = value === iconName
                return (
                  <button
                    key={iconName}
                    type="button"
                    title={iconName}
                    onClick={() => onChange(iconName)}
                    className={cn(
                      'flex items-center justify-center size-8 rounded-md border transition-colors',
                      isSelected
                        ? 'border-2'
                        : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
                    )}
                    style={isSelected ? { borderColor: color, backgroundColor: `${color}1a`, color } : undefined}
                  >
                    <Icon size={16} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {filteredGroups[0]?.icons.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No icons found</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/categories/LucideIconPicker.tsx
git commit -m "feat: add LucideIconPicker with 80 curated icons and search"
```

---

## Task 4: Wire `LucideIconPicker` into category form

**Files:**
- Modify: `src/components/features/categories/IconPicker.tsx`
- Modify: `src/components/features/categories/CategoryForm.tsx`

- [ ] **Step 1: Update `IconPicker.tsx`**

Replace entire file content:

```tsx
// src/components/features/categories/IconPicker.tsx
import { LucideIconPicker } from './LucideIconPicker'

interface IconPickerProps {
  value: string
  onChange: (value: string) => void
  error?: string
  color?: string
}

export function IconPicker({ value, onChange, error, color }: IconPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Icon</label>
      <LucideIconPicker value={value} onChange={onChange} color={color} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Update `CategoryForm.tsx` — pass color to IconPicker**

In `src/components/features/categories/CategoryForm.tsx`, find the `IconPicker` FormField render block (around line 78–90) and update it to pass `color`:

```tsx
<FormField
    control={form.control}
    name="icon"
    render={({ field }) => (
        <FormItem>
            <IconPicker
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.icon?.message}
                color={watchedValues.color}
            />
        </FormItem>
    )}
/>
```

Also change the default icon from emoji to a Lucide icon name. Find line:
```ts
icon: '🏠',
```
Replace with:
```ts
icon: 'House',
```

- [ ] **Step 3: Commit**

```bash
git add src/components/features/categories/IconPicker.tsx src/components/features/categories/CategoryForm.tsx
git commit -m "feat: replace emoji picker with LucideIconPicker in category form"
```

---

## Task 5: Update `CategoryPreview`

**Files:**
- Modify: `src/components/features/categories/CategoryPreview.tsx`

- [ ] **Step 1: Replace content**

```tsx
// src/components/features/categories/CategoryPreview.tsx
import { CategoryPill } from '@/components/shared/CategoryPill'

interface CategoryPreviewProps {
  name: string
  icon: string
  color: string
}

export function CategoryPreview({ name, icon, color }: CategoryPreviewProps) {
  return (
    <div className="p-4 border rounded-lg bg-muted/50">
      <p className="text-sm text-muted-foreground mb-2">Preview:</p>
      <CategoryPill name={name || 'Category name'} icon={icon} color={color} size="md" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/categories/CategoryPreview.tsx
git commit -m "feat: update CategoryPreview to use CategoryPill"
```

---

## Task 6: Update categories table columns

**Files:**
- Modify: `src/components/features/categories/columns.tsx`

- [ ] **Step 1: Replace the category name cell**

Add import at top:
```tsx
import { CategoryPill } from '@/components/shared'
```

Replace the `name` column cell (lines 34–49) with:

```tsx
{
    accessorKey: 'name',
    header: 'Category',
    cell: ({ row }) => (
        <CategoryPill
            name={row.original.name}
            icon={row.original.icon}
            color={row.original.color}
            size="md"
        />
    ),
},
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/categories/columns.tsx
git commit -m "feat: use CategoryPill in categories table"
```

---

## Task 7: Update `CategorySelect`

**Files:**
- Modify: `src/components/shared/CategorySelect.tsx`

- [ ] **Step 1: Replace category item rendering**

Add import:
```tsx
import { CategoryPill } from './CategoryPill'
```

Replace the `SelectItem` inner div (lines 62–70):
```tsx
<SelectItem key={category.id} value={category.id.toString()}>
  <CategoryPill
    name={category.name}
    icon={category.icon}
    color={category.color}
    size="sm"
  />
</SelectItem>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/CategorySelect.tsx
git commit -m "feat: use CategoryPill in CategorySelect dropdown"
```

---

## Task 8: Update recurring columns

**Files:**
- Modify: `src/components/features/recurring/columns.tsx`

- [ ] **Step 1: Replace category cell (around line 115–130)**

Add import at top:
```tsx
import { CategoryPill } from '@/components/shared'
```

Replace the category cell:
```tsx
{
  id: 'category',
  header: 'Category',
  cell: ({ row }) => {
    if (!row.original.category)
      return <span className="text-muted-foreground">-</span>
    return (
      <CategoryPill
        name={row.original.category.name}
        icon={row.original.category.icon}
        color={row.original.category.color}
        size="sm"
      />
    )
  },
},
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/recurring/columns.tsx
git commit -m "feat: use CategoryPill in recurring transactions table"
```

---

## Task 9: Update BudgetForm category list

**Files:**
- Modify: `src/components/features/budgets/BudgetForm.tsx`

- [ ] **Step 1: Find the category label span (around line 264–272)**

Add import at top of file:
```tsx
import { CategoryPill } from '@/components/shared'
```

Replace the `<FormLabel>` content that renders the colored square + category name:
```tsx
<FormLabel className="flex items-center font-normal cursor-pointer">
  <CategoryPill
    name={category.name}
    icon={category.icon}
    color={category.color}
    size="sm"
  />
</FormLabel>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/budgets/BudgetForm.tsx
git commit -m "feat: use CategoryPill in BudgetForm category list"
```

---

## Task 10: Update transactions columns

**Files:**
- Modify: `src/components/features/transactions/columns.tsx`

- [ ] **Step 1: Fix inline category display (line 155)**

The current code renders `category.icon` as emoji inline in text: `` {account.name}{category && ` · ${category.icon} ${category.name}`} ``

Add import:
```tsx
import { CategoryIcon } from '@/lib/category-icon'
```

Replace that return statement with:
```tsx
return (
  <span className="flex items-center gap-1 flex-wrap">
    <span>{account.name}</span>
    {category && (
      <>
        <span className="text-muted-foreground">·</span>
        <span
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: category.color }}
        >
          <CategoryIcon name={category.icon} size={12} />
          {category.name}
        </span>
      </>
    )}
  </span>
)
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/transactions/columns.tsx
git commit -m "feat: use CategoryIcon in transactions table category cell"
```

---

## Task 11: Update dashboard category display

**Files:**
- Modify: `src/pages/dashboard.tsx`

- [ ] **Step 1: Find and replace icon box (around line 733–748)**

Add import near top of file:
```tsx
import { CategoryIcon } from '@/lib/category-icon'
```

Replace the category icon block:
```tsx
<div
  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
  style={{
    backgroundColor: transaction.category?.color
      ? `${transaction.category.color}1a`
      : undefined,
    border: transaction.category?.color
      ? `1px solid ${transaction.category.color}`
      : undefined,
    color: transaction.category?.color,
  }}
>
  {transaction.category?.icon ? (
    <CategoryIcon name={transaction.category.icon} size={16} />
  ) : (
    <CreditCard className="size-4" />
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard.tsx
git commit -m "feat: use CategoryIcon in dashboard recent transactions"
```

---

## Task 12: Update transactions filter chips

**Files:**
- Modify: `src/pages/transactions/index.tsx`

- [ ] **Step 1: Replace Badge filter chips (around line 436–449)**

Add import:
```tsx
import { CategoryPill } from '@/components/shared'
```

Replace the `<Badge>` element inside `filteredCategories.map`:
```tsx
{filteredCategories.map((category) => {
  const isSelected = params.categoryIds.includes(category.id)
  return (
    <button
      key={category.id}
      type="button"
      onClick={() => toggleCategory(category.id)}
      className={cn(
        'transition-opacity',
        isSelected ? 'opacity-100' : 'opacity-50 hover:opacity-75'
      )}
    >
      <CategoryPill
        name={category.name}
        icon={category.icon}
        color={category.color}
        size="sm"
      />
    </button>
  )
})}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/transactions/index.tsx
git commit -m "feat: use CategoryPill in transaction filter chips"
```

---

## Task 13: Update reports components

**Files:**
- Modify: `src/pages/reports/components/TopIncome.tsx`
- Modify: `src/pages/reports/components/TopExpenses.tsx`
- Modify: `src/pages/reports/components/ExpensesByCategory.tsx`

> These three share the same pattern: a colored square with emoji. Replace with a `CategoryIcon` inside a styled container.

- [ ] **Step 1: Update `TopExpenses.tsx` (line 88–93)**

Add import:
```tsx
import { CategoryIcon } from '@/lib/category-icon'
```

Replace:
```tsx
<div
    className="flex items-center justify-center size-9 rounded-lg flex-shrink-0"
    style={{
      borderColor: transaction.category.color,
      border: `1px solid ${transaction.category.color}`,
      backgroundColor: `${transaction.category.color}1a`,
      color: transaction.category.color,
    }}
>
    <CategoryIcon name={transaction.category.icon} size={16} />
</div>
```

- [ ] **Step 2: Update `TopIncome.tsx` (same pattern)**

Add import:
```tsx
import { CategoryIcon } from '@/lib/category-icon'
```

Replace category icon div (same structure as TopExpenses):
```tsx
<div
    className="flex items-center justify-center size-9 rounded-lg flex-shrink-0"
    style={{
      borderColor: transaction.category.color,
      border: `1px solid ${transaction.category.color}`,
      backgroundColor: `${transaction.category.color}1a`,
      color: transaction.category.color,
    }}
>
    <CategoryIcon name={transaction.category.icon} size={16} />
</div>
```

- [ ] **Step 3: Update `ExpensesByCategory.tsx` (line 77–82)**

Add import:
```tsx
import { CategoryIcon } from '@/lib/category-icon'
```

Replace category icon div:
```tsx
<div
    className="flex items-center justify-center size-8 rounded-lg flex-shrink-0"
    style={{
      border: `1px solid ${category.color}`,
      backgroundColor: `${category.color}1a`,
      color: category.color,
    }}
>
    <CategoryIcon name={category.icon} size={16} />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/reports/components/TopExpenses.tsx src/pages/reports/components/TopIncome.tsx src/pages/reports/components/ExpensesByCategory.tsx
git commit -m "feat: use CategoryIcon in reports components"
```

---

## Task 14: Final type-check

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npx tsc --noEmit 2>&1 | head -50
```
Expected: no errors (or only pre-existing errors unrelated to this work)

- [ ] **Step 2: Run all tests**

```bash
cd /Users/ergiasllani/CREATIONS/xpp && npx vitest run 2>&1 | tail -20
```
Expected: all pass

- [ ] **Step 3: Verify CategorySelect barrel export**

```bash
grep -r "CategoryPill" /Users/ergiasllani/CREATIONS/xpp/src/components/shared/
```
Expected: `CategoryPill.tsx` exists and is exported from the barrel

- [ ] **Step 4: Commit if any fixes needed, then final commit**

```bash
git add -p
git commit -m "fix: resolve any type errors from category pill migration"
```
