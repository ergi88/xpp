// src/auth/setup/steps/CurrencyStep.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ISO_CURRENCIES, IsoCurrency } from '@/lib/iso-currencies'
import { currenciesApi, settingsApi } from '@/api'
import { useTheme } from '@/hooks/use-theme'

interface CurrencyStepProps {
  onNext: () => void
}

export function CurrencyStep({ onNext }: CurrencyStepProps) {
  const [selected, setSelected] = useState<IsoCurrency | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { theme, setTheme } = useTheme()

  const handleSubmit = async () => {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      await currenciesApi.create({
        code: selected.code,
        name: selected.name,
        symbol: selected.symbol,
        decimals: selected.decimals,
        isBase: true,
        rate: 1,
      })
      settingsApi.syncThemeToSheet(theme)
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create currency')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Base currency</Label>
        <Select onValueChange={code => setSelected(ISO_CURRENCIES.find(c => c.code === code) ?? null)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your currency…" />
          </SelectTrigger>
          <SelectContent>
            {ISO_CURRENCIES.map(c => (
              <SelectItem key={c.code} value={c.code}>
                <span className="font-mono text-xs mr-2 text-muted-foreground">{c.code}</span>
                {c.name}
                <span className="ml-2 text-muted-foreground">{c.symbol}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">All balances will display in this currency.</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Dark mode</p>
          <p className="text-xs text-muted-foreground">Switch between light and dark theme</p>
        </div>
        <Switch
          checked={theme === 'dark'}
          onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
        />
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Button onClick={handleSubmit} disabled={!selected || loading}>
        {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
        Continue
      </Button>
    </div>
  )
}
