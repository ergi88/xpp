// src/auth/setup/SetupWizard.tsx
import { useState } from 'react'
import { ConnectStep } from './steps/ConnectStep'
import { SecureStep } from './steps/SecureStep'
import { CurrencyStep } from './steps/CurrencyStep'
import { AccountStep } from './steps/AccountStep'

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
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            {STEPS.map((s, i) => (
              <div
                key={s.label}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
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
