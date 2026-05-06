// src/auth/setup/steps/SecureStep.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Fingerprint, Loader2 } from 'lucide-react'
import { STORAGE_KEYS, sha256, registerWebAuthn, isWebAuthnSupported } from '@/lib/auth'

const schema = z.object({
  email: z.string().email('Must be a valid email'),
  pin: z.string().min(4, 'PIN must be 4–6 digits').max(6).regex(/^\d+$/, 'Digits only'),
  pinConfirm: z.string(),
}).refine(d => d.pin === d.pinConfirm, { message: 'PINs do not match', path: ['pinConfirm'] })

type FormData = z.infer<typeof schema>
type Mode = 'choose' | 'pin'

interface SecureStepProps {
  onNext: () => void
}

export function SecureStep({ onNext }: SecureStepProps) {
  const [mode, setMode] = useState<Mode>(isWebAuthnSupported() ? 'choose' : 'pin')
  const [webAuthnLoading, setWebAuthnLoading] = useState(false)
  const [webAuthnError, setWebAuthnError] = useState('')

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const saveEmail = () => {
    const { email } = getValues()
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, email)
  }

  const handleWebAuthn = async () => {
    const { email } = getValues()
    if (!email) return
    setWebAuthnLoading(true)
    setWebAuthnError('')
    try {
      saveEmail()
      const credentialId = await registerWebAuthn(email)
      localStorage.setItem(STORAGE_KEYS.AUTH_CREDENTIAL_ID, credentialId)
      localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, 'webauthn')
      onNext()
    } catch (err) {
      setWebAuthnError(err instanceof Error ? err.message : 'WebAuthn setup failed')
    } finally {
      setWebAuthnLoading(false)
    }
  }

  const onPinSubmit = async (data: FormData) => {
    saveEmail()
    const hash = await sha256(data.pin)
    localStorage.setItem(STORAGE_KEYS.AUTH_PIN_HASH, hash)
    localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, 'pin')
    onNext()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Your email</Label>
        <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        <p className="text-xs text-muted-foreground">Used only to verify your identity if you forget your passkey. Never sent anywhere.</p>
      </div>

      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          {webAuthnError && (
            <Alert variant="destructive"><AlertDescription>{webAuthnError}</AlertDescription></Alert>
          )}
          <Button type="button" size="lg" onClick={handleWebAuthn} disabled={webAuthnLoading} className="gap-2">
            {webAuthnLoading ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-5" />}
            Set up Face ID / fingerprint / passkey
          </Button>
          <button className="text-xs text-muted-foreground underline self-center" onClick={() => setMode('pin')}>
            Use PIN instead
          </button>
        </div>
      )}

      {mode === 'pin' && (
        <form onSubmit={handleSubmit(onPinSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pin">PIN (4–6 digits)</Label>
            <Input id="pin" type="password" inputMode="numeric" maxLength={6} placeholder="••••••" {...register('pin')} />
            {errors.pin && <p className="text-xs text-destructive">{errors.pin.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pinConfirm">Confirm PIN</Label>
            <Input id="pinConfirm" type="password" inputMode="numeric" maxLength={6} placeholder="••••••" {...register('pinConfirm')} />
            {errors.pinConfirm && <p className="text-xs text-destructive">{errors.pinConfirm.message}</p>}
          </div>
          <Button type="submit">Continue</Button>
          {isWebAuthnSupported() && (
            <button type="button" className="text-xs text-muted-foreground underline self-center" onClick={() => setMode('choose')}>
              Use biometrics instead
            </button>
          )}
        </form>
      )}
    </div>
  )
}
