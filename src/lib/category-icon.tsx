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
