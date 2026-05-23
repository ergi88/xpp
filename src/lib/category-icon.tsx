import * as LucideIcons from "lucide-react";
import { LucideIcon, Tag } from "lucide-react";

export function getCategoryIconComponent(name: string): LucideIcon {
  if (!name || !(name in LucideIcons)) return Tag;
  return (LucideIcons as Record<string, unknown>)[name] as LucideIcon;
}

interface CategoryIconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}

export function CategoryIcon({
  name,
  size = 14,
  className,
  color,
}: CategoryIconProps) {
  const Icon = getCategoryIconComponent(name);
  return <Icon size={size} className={className} color={color} />;
}
