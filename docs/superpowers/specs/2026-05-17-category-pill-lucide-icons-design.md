# Category Pill + Lucide Icon Picker — Design Spec

**Date:** 2026-05-17  
**Status:** Approved

---

## Goal

Replace emoji-based category display app-wide with a pill-shaped component using the category's color for border, background (10% opacity via `1a` hex suffix), icon, and name text. Replace the emoji picker in category forms with a searchable Lucide icon picker. Store the Lucide icon name (e.g. `"ShoppingCart"`) in the existing `icon` column.

---

## Architecture

### 1. `CategoryIcon` utility (`src/lib/category-icon.tsx`)

Dynamic Lucide icon renderer by name string.

```tsx
import * as LucideIcons from 'lucide-react'

interface CategoryIconProps {
  name: string
  size?: number
  className?: string
}

export function CategoryIcon({ name, size = 14, className }: CategoryIconProps) {
  const Icon = (LucideIcons as Record<string, any>)[name] ?? LucideIcons.Tag
  return <Icon size={size} className={className} />
}
```

- Falls back to `Tag` for old emoji values (no crash during migration)
- `color` applied via CSS `currentColor` — parent sets `color` style

---

### 2. `CategoryPill` component (`src/components/shared/CategoryPill.tsx`)

Single source of truth for how categories render everywhere.

```tsx
interface CategoryPillProps {
  name: string
  icon: string
  color: string
  size?: 'sm' | 'md'
}
```

Visual spec:
- `border: 1px solid {color}`
- `background: {color}1a`
- `color: {color}` (icon + name inherit via currentColor)
- `border-radius: 9999px` (full pill)
- `sm`: `px-2 py-0.5`, icon size 12, text `text-xs`
- `md`: `px-3 py-1`, icon size 14, text `text-sm`

---

### 3. `LucideIconPicker` component (`src/components/features/categories/LucideIconPicker.tsx`)

Replaces `EmojiPicker` inside `IconPicker.tsx`.

- Grid layout, ~80 curated icons grouped by theme
- Groups: Money, Food & Drink, Shopping, Health, Travel, Home, Work, Entertainment, General
- Search input filters icon names (client-side, no async)
- Selected icon rendered with current category color
- Clicking an icon calls `onChange(iconName)` (stores string like `"ShoppingCart"`)

Curated icon list covers common personal-finance categories. No lazy loading needed at 80 icons.

---

### 4. `IconPicker` updated (`src/components/features/categories/IconPicker.tsx`)

Swap `EmojiPicker` → `LucideIconPicker`. Pass current `color` from form watch so selected icon shows in category color.

`CategoryForm` passes `color` watch value down to `IconPicker`.

---

### 5. `CategoryPreview` updated (`src/components/features/categories/CategoryPreview.tsx`)

Use `<CategoryPill size="md">` instead of manual square box.

---

## Render Sites (all → `CategoryPill`)

| File | Size | Notes |
|---|---|---|
| `components/features/categories/columns.tsx` | `md` | Table row |
| `components/features/categories/CategoryPreview.tsx` | `md` | Form preview |
| `components/shared/CategorySelect.tsx` | `sm` | Dropdown items |
| `components/features/budgets/BudgetForm.tsx` | `sm` | Category list in budget form |
| `components/features/recurring/columns.tsx` | `md` | Recurring table row |
| `components/features/transactions/columns.tsx` | `sm` | Transaction row category badge |
| `pages/dashboard.tsx` | `sm` | Recent transactions category |
| `pages/transactions/index.tsx` | `sm` | Filter chip in category filter dropdown |
| `pages/reports/components/TopIncome.tsx` | `sm` | Top income list |
| `pages/reports/components/TopExpenses.tsx` | `sm` | Top expenses list |
| `pages/reports/components/ExpensesByCategory.tsx` | `sm` | Category breakdown list |

---

## Data

- `Category.icon` type stays `string` — no schema change
- Old emoji values fall back to `Tag` icon gracefully
- User re-edits categories to select Lucide icons
- No migration script needed

---

## Out of Scope

- Chart legend icons (ECharts tooltips use raw HTML — leave as color dot)
- `IncomeDynamicsChart` / `ExpensesDynamicsChart` color dots in legends
- No backend schema changes needed
