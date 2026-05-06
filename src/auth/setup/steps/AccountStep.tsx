// src/auth/setup/steps/AccountStep.tsx
import { useState } from 'react'
import { AccountForm } from '@/components/features/accounts/AccountForm'
import { accountsApi } from '@/api'
import { STORAGE_KEYS } from '@/lib/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { AccountFormData } from '@/schemas'

interface AccountStepProps {
  onNext: () => void
}

export function AccountStep({ onNext }: AccountStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (data: AccountFormData) => {
    setIsSubmitting(true)
    setError('')
    try {
      await accountsApi.create(data)
      localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true')
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AccountForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Create account"
      />
    </div>
  )
}
