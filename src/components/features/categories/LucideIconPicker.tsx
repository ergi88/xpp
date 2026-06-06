import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { getCategoryIconComponent } from '@/lib/category-icon'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const CURATED_ICONS: { group: string; icons: string[] }[] = [
  {
    group: 'Money',
    icons: ['Wallet', 'WalletCards', 'CreditCard', 'Banknote', 'BadgeDollarSign', 'PiggyBank', 'TrendingUp', 'TrendingDown', 'DollarSign', 'Euro', 'PoundSterling', 'JapaneseYen', 'Bitcoin', 'Coins', 'Receipt', 'ReceiptText', 'HandCoins', 'CircleDollarSign', 'Landmark', 'Calculator', 'ChartNoAxesCombined', 'Percent', 'Vault', 'Scale'],
  },
  {
    group: 'Food & Drink',
    icons: ['UtensilsCrossed', 'Utensils', 'Coffee', 'CupSoda', 'Pizza', 'ShoppingBasket', 'Wine', 'Beer', 'Martini', 'IceCream', 'IceCreamCone', 'Sandwich', 'Salad', 'Apple', 'Cherry', 'Grape', 'Carrot', 'Egg', 'Beef', 'Fish', 'Croissant', 'Donut', 'Cake', 'CakeSlice', 'Candy', 'Cookie', 'Soup', 'Drumstick', 'Milk', 'Wheat'],
  },
  {
    group: 'Shopping',
    icons: ['ShoppingCart', 'ShoppingBag', 'Store', 'Tag', 'Tags', 'Gift', 'Package', 'PackageOpen', 'Shirt', 'Gem', 'Watch', 'Glasses', 'Footprints', 'Crown', 'Sparkles', 'Barcode', 'ScanLine', 'Ticket', 'BadgePercent'],
  },
  {
    group: 'Health',
    icons: ['Heart', 'HeartPulse', 'Activity', 'Pill', 'Stethoscope', 'Syringe', 'Dumbbell', 'Brain', 'Eye', 'Ear', 'Thermometer', 'Hospital', 'Baby', 'Bone', 'Smile', 'Cross', 'BriefcaseMedical', 'Bandage', 'Accessibility', 'Bed'],
  },
  {
    group: 'Travel',
    icons: ['Plane', 'PlaneTakeoff', 'Car', 'CarFront', 'Train', 'TramFront', 'Bus', 'Bike', 'Ship', 'Sailboat', 'Map', 'MapPin', 'MapPinned', 'Compass', 'Hotel', 'Tent', 'Luggage', 'Fuel', 'ParkingCircle', 'TrafficCone', 'Globe', 'Mountain', 'Palmtree', 'Caravan'],
  },
  {
    group: 'Home',
    icons: ['House', 'HousePlus', 'DoorOpen', 'Sofa', 'Armchair', 'Lamp', 'Lightbulb', 'Tv', 'Refrigerator', 'WashingMachine', 'Microwave', 'CookingPot', 'Wrench', 'Hammer', 'Drill', 'PaintRoller', 'Trash2', 'Flame', 'Droplets', 'Plug', 'PlugZap', 'Zap', 'Key', 'Bath', 'Toilet', 'Bed', 'Brush', 'TreePine', 'Flower2', 'Shovel'],
  },
  {
    group: 'Work',
    icons: ['Briefcase', 'Laptop', 'Monitor', 'Phone', 'Smartphone', 'Printer', 'BookOpen', 'PenLine', 'Pencil', 'FolderOpen', 'Folder', 'FileText', 'Files', 'Building', 'Building2', 'Factory', 'GraduationCap', 'NotebookPen', 'Presentation', 'Mail', 'Paperclip', 'Stamp', 'IdCard', 'Network'],
  },
  {
    group: 'Tech',
    icons: ['Smartphone', 'Tablet', 'Laptop', 'Monitor', 'MonitorSmartphone', 'Keyboard', 'Mouse', 'HardDrive', 'Server', 'Database', 'Cpu', 'MemoryStick', 'Wifi', 'Bluetooth', 'Cloud', 'CloudDownload', 'Battery', 'BatteryCharging', 'Cable', 'Router', 'Usb', 'Webcam', 'Code', 'Bot'],
  },
  {
    group: 'Entertainment',
    icons: ['Music', 'Music2', 'Disc3', 'Radio', 'Mic', 'Gamepad2', 'Joystick', 'Clapperboard', 'Film', 'Camera', 'Video', 'Book', 'BookMarked', 'Headphones', 'Ticket', 'Palette', 'Brush', 'Trophy', 'Medal', 'Award', 'Dice5', 'Puzzle', 'PartyPopper', 'Drama', 'Guitar', 'Piano', 'Popcorn'],
  },
  {
    group: 'Sports & Outdoors',
    icons: ['Dumbbell', 'Bike', 'Footprints', 'Trophy', 'Medal', 'Target', 'Goal', 'Volleyball', 'Waves', 'Tent', 'TreePine', 'Mountain', 'MountainSnow', 'Snowflake', 'Sun', 'Flag', 'Timer', 'Compass'],
  },
  {
    group: 'Family & Pets',
    icons: ['Users', 'User', 'Baby', 'PersonStanding', 'Heart', 'Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Turtle', 'PawPrint', 'Bone', 'Squirrel', 'Rat'],
  },
  {
    group: 'Bills & Utilities',
    icons: ['Receipt', 'FileText', 'Zap', 'Flame', 'Droplet', 'Droplets', 'Wifi', 'Phone', 'Tv', 'Trash2', 'Lightbulb', 'Plug', 'ThermometerSun', 'Recycle', 'CalendarClock', 'Banknote'],
  },
  {
    group: 'Education',
    icons: ['GraduationCap', 'BookOpen', 'Book', 'BookMarked', 'Library', 'Pencil', 'PenLine', 'NotebookPen', 'Ruler', 'Calculator', 'Backpack', 'School', 'Microscope', 'FlaskConical', 'Atom', 'Globe'],
  },
  {
    group: 'Misc',
    icons: ['Star', 'Heart', 'Flag', 'Bookmark', 'Bell', 'Calendar', 'Clock', 'MapPin', 'Camera', 'Gift', 'Lightbulb', 'Sparkles', 'Leaf', 'Sun', 'Moon', 'Cloud', 'Umbrella', 'ShieldCheck', 'Lock', 'Smile', 'ThumbsUp', 'Infinity', 'CircleHelp', 'MoreHorizontal'],
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
