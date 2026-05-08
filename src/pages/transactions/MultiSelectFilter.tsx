import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

export interface FilterOption {
    value: string
    label: string
    icon?: ReactNode
}

interface MultiSelectFilterProps {
    label: string
    options: FilterOption[]
    selected: string[]
    onChange: (selected: string[]) => void
}

export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
    const allSelected = selected.length === options.length

    const toggleAll = () => {
        onChange(allSelected ? [] : options.map(o => o.value))
    }

    const toggle = (value: string) => {
        onChange(
            selected.includes(value)
                ? selected.filter(v => v !== value)
                : [...selected, value]
        )
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                    {label}
                    {selected.length > 0 && (
                        <Badge variant="secondary" className="ml-1 px-1.5">
                            {selected.length}
                        </Badge>
                    )}
                    <ChevronDown className="ml-1 size-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
                <div className="space-y-0.5">
                    <div
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                        onClick={toggleAll}
                    >
                        <Checkbox
                            checked={allSelected}
                            className="pointer-events-none"
                        />
                        <span className="text-sm font-medium">All</span>
                    </div>
                    <div className="border-t my-1" />
                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {options.map(opt => (
                            <div
                                key={opt.value}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                                onClick={() => toggle(opt.value)}
                            >
                                <Checkbox
                                    checked={selected.includes(opt.value)}
                                    className="pointer-events-none"
                                />
                                {opt.icon && <span className="size-4 flex items-center">{opt.icon}</span>}
                                <span className="text-sm">{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
