// src/auth/setup/steps/ConnectStep.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { STORAGE_KEYS } from '@/lib/auth'

const schema = z.object({
  gasUrl: z.string().url('Must be a valid URL').includes('script.google.com', { message: 'Must be a Google Apps Script URL' }),
  spreadsheetId: z.string().min(10, 'Spreadsheet ID is required'),
})
type FormData = z.infer<typeof schema>

interface ConnectStepProps {
  onNext: () => void
}

export function ConnectStep({ onNext }: ConnectStepProps) {
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const { register, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const handleTest = async () => {
    const { gasUrl, spreadsheetId } = getValues()
    if (!gasUrl || !spreadsheetId) return
    setTestState('loading')
    setTestError('')
    try {
      const url = new URL(gasUrl)
      url.searchParams.set('resource', 'currencies')
      url.searchParams.set('action', 'getAll')
      const res = await fetch(url.toString())
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl)
      localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId)
      setTestState('success')
    } catch (err) {
      setTestState('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="gasUrl">Google Apps Script URL</Label>
        <Input id="gasUrl" placeholder="https://script.google.com/macros/s/.../exec" {...register('gasUrl')} />
        {errors.gasUrl && <p className="text-xs text-destructive">{errors.gasUrl.message}</p>}
        <p className="text-xs text-muted-foreground">
          Go to{' '}
          <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
            Google Apps Script <ExternalLink className="size-3" />
          </a>
          {' '}→ Deploy → New deployment → Web app → Copy the URL
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
        <Input id="spreadsheetId" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" {...register('spreadsheetId')} />
        {errors.spreadsheetId && <p className="text-xs text-destructive">{errors.spreadsheetId.message}</p>}
        <p className="text-xs text-muted-foreground">
          Find it in your sheet URL: docs.google.com/spreadsheets/d/<span className="font-mono font-semibold">ID</span>/edit
        </p>
      </div>

      {testState === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>{testError}</AlertDescription>
        </Alert>
      )}

      {testState === 'success' && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>Connection successful!</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={handleTest} disabled={testState === 'loading'}>
          {testState === 'loading' && <Loader2 className="size-4 mr-2 animate-spin" />}
          Test connection
        </Button>
        <Button type="button" onClick={onNext} disabled={testState !== 'success'}>
          Continue
        </Button>
      </div>
    </div>
  )
}
