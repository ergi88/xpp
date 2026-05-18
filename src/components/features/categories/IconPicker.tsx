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
