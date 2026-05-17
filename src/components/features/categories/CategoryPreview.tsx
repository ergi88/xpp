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
