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
          <Button variant="destructive" onClick={handleReset}>Reset &amp; re-setup</Button>
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
