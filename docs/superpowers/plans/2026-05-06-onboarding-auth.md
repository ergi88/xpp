# Onboarding, Auth & Lock System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run setup wizard (GAS connection → auth → currency → account), a PIN/WebAuthn lock screen, and manual + inactivity auto-lock.

**Architecture:** Two gate components (`SetupGate`, `AuthGate`) wrap `RouterProvider` in `App.tsx`. They render before any route mounts, so no API calls fire until both gates clear. Auth state lives in `AuthContext`; all persistence is localStorage.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui (existing), lucide-react, Web Crypto API (sha256), WebAuthn (`navigator.credentials`), react-hook-form + zod (existing)

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `src/lib/auth.ts` | sha256 hash, WebAuthn register/verify helpers |
| `src/lib/iso-currencies.ts` | Static ISO 4217 currency list |
| `src/auth/AuthContext.tsx` | `isLocked`, `lock()`, `unlock()`, `AuthProvider` |
| `src/auth/useActivityTracker.ts` | Mouse/key/touch events → update `xpp_last_activity` |
| `src/auth/lock-screen/LockScreen.tsx` | WebAuthn or PIN unlock UI |
| `src/auth/lock-screen/ForgotPasskey.tsx` | Masked email confirm → wipe auth → re-setup |
| `src/auth/AuthGate.tsx` | Renders `LockScreen` or children based on lock state |
| `src/auth/SetupGate.tsx` | Renders `SetupWizard` or children based on setup state |
| `src/auth/setup/SetupWizard.tsx` | Stepper shell, 4-step state machine |
| `src/auth/setup/steps/ConnectStep.tsx` | GAS URL + Sheet ID inputs + test connection |
| `src/auth/setup/steps/SecureStep.tsx` | Email + WebAuthn/PIN enrollment |
| `src/auth/setup/steps/CurrencyStep.tsx` | ISO currency dropdown + theme toggle |
| `src/auth/setup/steps/AccountStep.tsx` | First account creation (reuses `AccountForm`) |

### Modified files
| Path | Change |
|------|--------|
| `src/lib/sheets/gas-adapter.ts` | Read `localStorage.getItem('xpp_gas_url')` before env var |
| `src/app/App.tsx` | Wrap with `<SetupGate><AuthGate>` |
| `src/components/layout/Header.tsx` | Add lock icon button calling `lock()` from `AuthContext` |
| `src/pages/settings/system.tsx` | Add auto-lock timeout field |
| `src/types/settings.ts` | Add `lock_timeout_minutes` field |
| `src/api/settings.ts` | Add `lock_timeout_minutes` to defaults |

---

## Task 1: Auth utility functions

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```typescript
// src/lib/auth.ts

export const STORAGE_KEYS = {
  SETUP_COMPLETE: 'xpp_setup_complete',
  GAS_URL: 'xpp_gas_url',
  SPREADSHEET_ID: 'xpp_spreadsheet_id',
  AUTH_EMAIL: 'xpp_auth_email',
  AUTH_METHOD: 'xpp_auth_method',
  AUTH_PIN_HASH: 'xpp_auth_pin_hash',
  AUTH_CREDENTIAL_ID: 'xpp_auth_credential_id',
  LOCK_TIMEOUT: 'xpp_lock_timeout_minutes',
  LAST_ACTIVITY: 'xpp_last_activity',
} as const

export type AuthMethod = 'webauthn' | 'pin'

export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || local.length <= 2) return email
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
}

export function clearAuthStorage(): void {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window
}

export async function registerWebAuthn(email: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'xpp Finance', id: window.location.hostname },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential | null

  if (!credential) throw new Error('WebAuthn registration cancelled')

  return btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
}

export async function verifyWebAuthn(credentialIdB64: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const credentialId = Uint8Array.from(atob(credentialIdB64), c => c.charCodeAt(0))

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: credentialId }],
        userVerification: 'required',
        timeout: 60000,
      },
    })

    return assertion !== null
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): add sha256, WebAuthn helpers, and storage key constants"
```

---

## Task 2: ISO 4217 currency list

**Files:**
- Create: `src/lib/iso-currencies.ts`

- [ ] **Step 1: Create `src/lib/iso-currencies.ts`**

```typescript
// src/lib/iso-currencies.ts

export interface IsoCurrency {
  code: string
  name: string
  symbol: string
  decimals: number
}

export const ISO_CURRENCIES: IsoCurrency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 0 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2 },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2 },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', decimals: 2 },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', decimals: 0 },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimals: 8 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimals: 8 },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/iso-currencies.ts
git commit -m "feat(auth): add ISO 4217 currency list"
```

---

## Task 3: Update gas-adapter for runtime URL

**Files:**
- Modify: `src/lib/sheets/gas-adapter.ts`

- [ ] **Step 1: Replace the `url()` function**

In `src/lib/sheets/gas-adapter.ts`, replace:

```typescript
const url = () => {
  const u = import.meta.env.VITE_GAS_URL as string
  if (!u) throw new Error('VITE_GAS_URL is not set')
  return u
}
```

With:

```typescript
const url = () => {
  const u = localStorage.getItem('xpp_gas_url') || (import.meta.env.VITE_GAS_URL as string)
  if (!u) throw new Error('GAS URL not configured. Complete setup first.')
  return u
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sheets/gas-adapter.ts
git commit -m "feat(auth): read GAS URL from localStorage, fall back to env var"
```

---

## Task 4: AuthContext

**Files:**
- Create: `src/auth/AuthContext.tsx`

- [ ] **Step 1: Create `src/auth/AuthContext.tsx`**

```typescript
// src/auth/AuthContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { STORAGE_KEYS } from '@/lib/auth'

interface AuthContextValue {
  isLocked: boolean
  lock: () => void
  unlock: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true)

  const lock = useCallback(() => setIsLocked(true), [])
  const unlock = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(Date.now()))
    setIsLocked(false)
  }, [])

  useEffect(() => {
    const timeout = Number(localStorage.getItem(STORAGE_KEYS.LOCK_TIMEOUT) ?? '5')
    const lastActivity = Number(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) ?? '0')
    const elapsed = (Date.now() - lastActivity) / 60000

    if (lastActivity > 0 && elapsed < timeout) {
      setIsLocked(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/AuthContext.tsx
git commit -m "feat(auth): add AuthContext with lock/unlock state"
```

---

## Task 5: useActivityTracker hook

**Files:**
- Create: `src/auth/useActivityTracker.ts`

- [ ] **Step 1: Create `src/auth/useActivityTracker.ts`**

```typescript
// src/auth/useActivityTracker.ts
import { useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { STORAGE_KEYS } from '@/lib/auth'

export function useActivityTracker() {
  const { lock, isLocked } = useAuth()
  const lastWriteRef = useRef(0)

  useEffect(() => {
    if (isLocked) return

    const updateActivity = () => {
      const now = Date.now()
      if (now - lastWriteRef.current < 1000) return
      lastWriteRef.current = now
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(now))
    }

    const checkTimeout = () => {
      const timeout = Number(localStorage.getItem(STORAGE_KEYS.LOCK_TIMEOUT) ?? '5')
      const lastActivity = Number(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) ?? '0')
      const elapsedMinutes = (Date.now() - lastActivity) / 60000
      if (elapsedMinutes >= timeout) lock()
    }

    const events = ['mousemove', 'keydown', 'touchstart', 'click'] as const
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }))

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkTimeout()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const interval = setInterval(checkTimeout, 30_000)

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(interval)
    }
  }, [isLocked, lock])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/useActivityTracker.ts
git commit -m "feat(auth): add useActivityTracker for inactivity auto-lock"
```

---

## Task 6: ForgotPasskey component

**Files:**
- Create: `src/auth/lock-screen/ForgotPasskey.tsx`

- [ ] **Step 1: Create `src/auth/lock-screen/ForgotPasskey.tsx`**

```typescript
// src/auth/lock-screen/ForgotPasskey.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { maskEmail, clearAuthStorage, STORAGE_KEYS } from '@/lib/auth'

interface ForgotPasskeyProps {
  onCancel: () => void
}

export function ForgotPasskey({ onCancel }: ForgotPasskeyProps) {
  const [confirmed, setConfirmed] = useState(false)
  const email = localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL) ?? ''
  const masked = maskEmail(email)

  const handleReset = () => {
    clearAuthStorage()
    window.location.reload()
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          This will delete your passkey and all setup data. Your financial data in Google Sheets is safe.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={handleReset}>Reset & re-setup</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">
        Registered email: <span className="font-mono font-medium">{masked}</span>
      </p>
      <p className="text-xs text-muted-foreground">Is this your account?</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="default" onClick={() => setConfirmed(true)}>Yes, reset passkey</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/lock-screen/ForgotPasskey.tsx
git commit -m "feat(auth): add ForgotPasskey component with masked email confirm"
```

---

## Task 7: LockScreen component

**Files:**
- Create: `src/auth/lock-screen/LockScreen.tsx`

- [ ] **Step 1: Create `src/auth/lock-screen/LockScreen.tsx`**

```typescript
// src/auth/lock-screen/LockScreen.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Fingerprint, Lock } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { ForgotPasskey } from './ForgotPasskey'
import { STORAGE_KEYS, sha256, verifyWebAuthn, AuthMethod } from '@/lib/auth'
import { useAuth } from '../AuthContext'
import { cn } from '@/lib/utils'

export function LockScreen() {
  const { unlock } = useAuth()
  const method = localStorage.getItem(STORAGE_KEYS.AUTH_METHOD) as AuthMethod | null
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleWebAuthn = async () => {
    setLoading(true)
    try {
      const credentialId = localStorage.getItem(STORAGE_KEYS.AUTH_CREDENTIAL_ID) ?? ''
      const ok = await verifyWebAuthn(credentialId)
      if (ok) {
        unlock()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handlePin = async () => {
    const stored = localStorage.getItem(STORAGE_KEYS.AUTH_PIN_HASH) ?? ''
    const hash = await sha256(pin)
    if (hash === stored) {
      unlock()
    } else {
      setError(true)
      setPin('')
      setTimeout(() => setError(false), 600)
    }
  }

  if (showForgot) {
    return (
      <FullScreen>
        <ForgotPasskey onCancel={() => setShowForgot(false)} />
      </FullScreen>
    )
  }

  return (
    <FullScreen>
      <Logo className="mb-6 h-10 w-10" />
      <div className="flex items-center gap-2 mb-8 text-muted-foreground">
        <Lock className="size-4" />
        <span className="text-sm">App locked</span>
      </div>

      {method === 'webauthn' ? (
        <div className="flex flex-col items-center gap-4">
          <Button size="lg" onClick={handleWebAuthn} disabled={loading} className="gap-2">
            <Fingerprint className="size-5" />
            {loading ? 'Verifying…' : 'Unlock with biometrics'}
          </Button>
          {error && <p className="text-sm text-destructive">Authentication failed. Try again.</p>}
          <button
            className="text-xs text-muted-foreground underline mt-2"
            onClick={() => setShowForgot(true)}
          >
            Forgot passkey?
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={e => {
              setError(false)
              setPin(e.target.value.replace(/\D/g, ''))
            }}
            onKeyDown={e => e.key === 'Enter' && handlePin()}
            placeholder="Enter PIN"
            className={cn('text-center text-2xl tracking-widest font-mono', error && 'border-destructive animate-shake')}
            autoFocus
          />
          <Button className="w-full" onClick={handlePin} disabled={pin.length < 4}>
            Unlock
          </Button>
          {error && <p className="text-sm text-destructive">Wrong PIN. Try again.</p>}
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowForgot(true)}
          >
            Forgot passkey?
          </button>
        </div>
      )}
    </FullScreen>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Add `animate-shake` keyframe to `src/index.css`**

Open `src/index.css` and add inside the `@layer utilities` block (or at end of file if no such block):

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.animate-shake {
  animation: shake 0.4s ease-in-out;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/auth/lock-screen/LockScreen.tsx src/index.css
git commit -m "feat(auth): add LockScreen with WebAuthn and PIN unlock"
```

---

## Task 8: AuthGate component

**Files:**
- Create: `src/auth/AuthGate.tsx`

- [ ] **Step 1: Create `src/auth/AuthGate.tsx`**

```typescript
// src/auth/AuthGate.tsx
import { AuthProvider, useAuth } from './AuthContext'
import { LockScreen } from './lock-screen/LockScreen'
import { useActivityTracker } from './useActivityTracker'

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAuth()
  useActivityTracker()
  return isLocked ? <LockScreen /> : <>{children}</>
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGateInner>{children}</AuthGateInner>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/AuthGate.tsx
git commit -m "feat(auth): add AuthGate wrapping AuthProvider + LockScreen"
```

---

## Task 9: ConnectStep

**Files:**
- Create: `src/auth/setup/steps/ConnectStep.tsx`

- [ ] **Step 1: Create `src/auth/setup/steps/ConnectStep.tsx`**

```typescript
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

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormData>({
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

  const onSubmit = () => {
    if (testState === 'success') onNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
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
        <Button type="submit" disabled={testState !== 'success'}>
          Continue
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/setup/steps/ConnectStep.tsx
git commit -m "feat(setup): add ConnectStep with GAS URL + connection test"
```

---

## Task 10: SecureStep

**Files:**
- Create: `src/auth/setup/steps/SecureStep.tsx`

- [ ] **Step 1: Create `src/auth/setup/steps/SecureStep.tsx`**

```typescript
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
            {webAuthnLoading
              ? <Loader2 className="size-4 animate-spin" />
              : <Fingerprint className="size-5" />}
            Set up Face ID / fingerprint / passkey
          </Button>
          <button
            className="text-xs text-muted-foreground underline self-center"
            onClick={() => setMode('pin')}
          >
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
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/setup/steps/SecureStep.tsx
git commit -m "feat(setup): add SecureStep with WebAuthn and PIN enrollment"
```

---

## Task 11: CurrencyStep

**Files:**
- Create: `src/auth/setup/steps/CurrencyStep.tsx`

- [ ] **Step 1: Create `src/auth/setup/steps/CurrencyStep.tsx`**

```typescript
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
import { currenciesApi } from '@/api'
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
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/setup/steps/CurrencyStep.tsx
git commit -m "feat(setup): add CurrencyStep with ISO dropdown and theme toggle"
```

---

## Task 12: AccountStep

**Files:**
- Create: `src/auth/setup/steps/AccountStep.tsx`

- [ ] **Step 1: Check AccountForm props**

Read `src/components/features/accounts/AccountForm.tsx` to understand what props it accepts and how to call `currenciesApi.getAll()` vs the React Query hook. Note which fields are required.

- [ ] **Step 2: Create `src/auth/setup/steps/AccountStep.tsx`**

```typescript
// src/auth/setup/steps/AccountStep.tsx
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState } from 'react'
import { accountsApi } from '@/api'
import { AccountForm } from '@/components/features/accounts/AccountForm'
import { AccountFormData } from '@/types'
import { STORAGE_KEYS } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

interface AccountStepProps {
  onNext: () => void
}

export function AccountStep({ onNext }: AccountStepProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (data: AccountFormData) => {
    setLoading(true)
    setError('')
    try {
      await accountsApi.create(data)
      localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true')
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AccountForm onSubmit={handleSubmit} submitLabel="Finish setup" isLoading={loading} />
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  )
}
```

> **Note:** If `AccountForm` does not accept `onSubmit` / `isLoading` / `submitLabel` props directly, read the component and adapt accordingly. The pattern across this codebase is form components that call their own mutation hooks internally. In that case, use `useCreateAccount` hook variant that accepts an `onSuccess` callback, or adapt `AccountForm` to accept an optional `onSuccess` prop.

- [ ] **Step 3: Commit**

```bash
git add src/auth/setup/steps/AccountStep.tsx
git commit -m "feat(setup): add AccountStep using AccountForm for first account"
```

---

## Task 13: SetupWizard shell

**Files:**
- Create: `src/auth/setup/SetupWizard.tsx`

- [ ] **Step 1: Read the Stepper component API**

Read `src/components/ui/stepper.tsx` fully to understand the exact component names and props (`Stepper`, `Step`, `StepHeader`, etc.).

- [ ] **Step 2: Create `src/auth/setup/SetupWizard.tsx`**

```typescript
// src/auth/setup/SetupWizard.tsx
import { useState } from 'react'
import { ConnectStep } from './steps/ConnectStep'
import { SecureStep } from './steps/SecureStep'
import { CurrencyStep } from './steps/CurrencyStep'
import { AccountStep } from './steps/AccountStep'
import { Logo } from '@/components/shared/Logo'

const STEPS = [
  { label: 'Connect', description: 'Link your Google Sheet' },
  { label: 'Secure', description: 'Set up your passkey' },
  { label: 'Currency', description: 'Choose base currency' },
  { label: 'Account', description: 'Create your first account' },
]

export function SetupWizard() {
  const [step, setStep] = useState(0)

  const next = () => setStep(s => s + 1)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <Logo className="mb-8 h-10 w-10" />
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            {STEPS.map((s, i) => (
              <div
                key={s.label}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </p>
          <h1 className="text-xl font-semibold mt-1">{STEPS[step].description}</h1>
        </div>

        {step === 0 && <ConnectStep onNext={next} />}
        {step === 1 && <SecureStep onNext={next} />}
        {step === 2 && <CurrencyStep onNext={next} />}
        {step === 3 && <AccountStep onNext={next} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/auth/setup/SetupWizard.tsx
git commit -m "feat(setup): add SetupWizard shell with 4-step progress bar"
```

---

## Task 14: SetupGate component

**Files:**
- Create: `src/auth/SetupGate.tsx`

- [ ] **Step 1: Create `src/auth/SetupGate.tsx`**

```typescript
// src/auth/SetupGate.tsx
import { STORAGE_KEYS } from '@/lib/auth'
import { SetupWizard } from './setup/SetupWizard'

export function SetupGate({ children }: { children: React.ReactNode }) {
  const isComplete = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true'
  return isComplete ? <>{children}</> : <SetupWizard />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/SetupGate.tsx
git commit -m "feat(setup): add SetupGate that blocks app until wizard completes"
```

---

## Task 15: Wire gates into App.tsx

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Update `src/app/App.tsx`**

Replace the current content with:

```typescript
import { Providers } from './providers'
import { RouterProvider } from 'react-router-dom'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { router } from './router'
import { SetupGate } from '@/auth/SetupGate'
import { AuthGate } from '@/auth/AuthGate'

export function App() {
  return (
    <Providers>
      <SetupGate>
        <AuthGate>
          <NuqsAdapter>
            <RouterProvider router={router} />
          </NuqsAdapter>
        </AuthGate>
      </SetupGate>
    </Providers>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(auth): wire SetupGate and AuthGate into App"
```

---

## Task 16: Lock button in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add lock button to Header**

Add import at the top of `src/components/layout/Header.tsx`:

```typescript
import { Lock } from 'lucide-react'  // add to existing lucide import line
import { useAuth } from '@/auth/AuthContext'
```

Inside the `Header` function, add:

```typescript
const { lock } = useAuth()
```

In the JSX, add a lock button immediately before the hide-amounts button:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={lock}
  aria-label="Lock app"
>
  <Lock className="h-5 w-5" />
</Button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(auth): add lock button to Header"
```

---

## Task 17: Auto-lock timeout in System Settings

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/api/settings.ts`
- Modify: `src/pages/settings/system.tsx`

- [ ] **Step 1: Add field to Settings type**

In `src/types/settings.ts`, add `lock_timeout_minutes` to the `Settings` interface:

```typescript
export interface Settings {
    auto_update_currencies: boolean
    hide_amounts: boolean
    lock_timeout_minutes: number
}
```

- [ ] **Step 2: Add default to settings API**

In `src/api/settings.ts`, add to `defaults`:

```typescript
const defaults: Settings = {
  auto_update_currencies: false,
  hide_amounts: false,
  lock_timeout_minutes: 5,
}
```

Also update `settingsApi.update` to sync `lock_timeout_minutes` to `STORAGE_KEYS.LOCK_TIMEOUT` when it changes. At the end of the `update` function, before returning, add:

```typescript
if (data.lock_timeout_minutes !== undefined) {
  localStorage.setItem('xpp_lock_timeout_minutes', String(data.lock_timeout_minutes))
}
```

- [ ] **Step 3: Add UI to system settings page**

In `src/pages/settings/system.tsx`, find the `Appearance` card and add a new card after it:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Security</CardTitle>
    <CardDescription>
      Configure auto-lock behavior
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Label htmlFor="lockTimeout" className="text-base font-medium">
          Auto-lock timeout
        </Label>
        <p className="text-sm text-muted-foreground">
          Lock the app after this many minutes of inactivity (1–60).
        </p>
      </div>
      <Input
        id="lockTimeout"
        type="number"
        min={1}
        max={60}
        className="w-24"
        defaultValue={settings?.lock_timeout_minutes ?? 5}
        onBlur={e => {
          const val = Math.min(60, Math.max(1, Number(e.target.value)))
          updateSettings.mutate({ lock_timeout_minutes: val })
        }}
      />
    </div>
  </CardContent>
</Card>
```

Add `Input` to the existing imports from `@/components/ui/input` if not already present.

- [ ] **Step 4: Commit**

```bash
git add src/types/settings.ts src/api/settings.ts src/pages/settings/system.tsx
git commit -m "feat(auth): add auto-lock timeout setting to system settings"
```

---

## Task 18: Smoke test the full flow

- [ ] **Step 1: Build and verify no TypeScript errors**

```bash
npm run build
```

Expected: exits 0 with no errors.

- [ ] **Step 2: Open the app in dev mode**

```bash
npm run dev
```

Open http://localhost:5178. Expected: setup wizard shown (ConnectStep), NOT the main app.

- [ ] **Step 3: Test setup flow manually**

1. Enter a valid GAS URL and Sheet ID → click "Test connection" → verify success state
2. Click Continue → SecureStep shown
3. Enter email + PIN (or use biometrics if available) → Continue
4. Select a currency → toggle theme → Continue
5. Create an account → Finish setup
6. Verify: main app dashboard loads

- [ ] **Step 4: Test lock flow**

1. Click the lock icon in the header → lock screen shown
2. Enter PIN (or biometrics) → app unlocks
3. Click "Forgot passkey?" → verify masked email shown → cancel
4. Wait for auto-lock timeout (set to 1 min in settings, wait) → verify locks

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```

---

## Self-Review

### Spec coverage check
| Spec requirement | Covered by |
|-----------------|-----------|
| GAS URL runtime config | Task 3 (gas-adapter), Task 9 (ConnectStep) |
| Spreadsheet ID capture | Task 9 (ConnectStep) |
| Connection test | Task 9 (ConnectStep `handleTest`) |
| Email capture | Task 10 (SecureStep) |
| WebAuthn registration | Task 1 (`registerWebAuthn`), Task 10 |
| PIN enrollment | Task 1 (`sha256`), Task 10 |
| PIN fallback | Task 10 (mode toggle) |
| Base currency selection | Task 11 (ISO dropdown) |
| Theme selection | Task 11 (dark mode switch) |
| First account creation | Task 12 |
| Setup completion flag | Task 12 (writes `xpp_setup_complete`) |
| SetupGate blocks app | Task 14 |
| AuthGate blocks app | Task 8 |
| WebAuthn lock screen | Task 7 (LockScreen) |
| PIN lock screen | Task 7 (LockScreen) |
| Forgot passkey | Task 6 (ForgotPasskey) |
| Masked email display | Task 1 (`maskEmail`), Task 6 |
| Wipe auth on forgot | Task 1 (`clearAuthStorage`), Task 6 |
| Manual lock button | Task 16 (Header) |
| Auto-lock on inactivity | Task 5 (useActivityTracker) |
| Auto-lock on tab switch | Task 5 (visibilitychange) |
| Auto-lock timeout setting | Task 17 |
| AuthContext shared state | Task 4 |

All spec requirements covered. ✓
