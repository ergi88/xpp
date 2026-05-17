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
