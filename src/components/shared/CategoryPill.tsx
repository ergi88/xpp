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
