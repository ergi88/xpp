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
