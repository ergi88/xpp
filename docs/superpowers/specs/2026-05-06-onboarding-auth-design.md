# Onboarding, Auth & Lock System

**Date:** 2026-05-06
**Status:** Approved

## Problem

Fresh install has no GAS URL, no currencies, no accounts. Sync does nothing. No guidance for new users. No access control.

## Scope

1. First-run setup wizard (GAS connection → auth → base currency → first account)
2. Auth gate (WebAuthn / PIN lock screen on every load)
3. Lock system (manual lock + auto-lock on inactivity)

---

## Storage Schema

All state in localStorage. No backend required.

| Key | Value | Notes |
|-----|-------|-------|
| `xpp_setup_complete` | `"true"` | Set on wizard completion |
| `xpp_gas_url` | URL string | Overrides build-time `VITE_GAS_URL` |
| `xpp_spreadsheet_id` | ID string | Display only (links in settings) |
| `xpp_auth_email` | email string | Never sent anywhere; shown masked in forgot flow |
| `xpp_auth_method` | `"webauthn"` \| `"pin"` | Determines unlock UI |
| `xpp_auth_pin_hash` | hex string | SHA-256 of PIN, never plain |
| `xpp_auth_credential_id` | base64 string | WebAuthn credential ID |
| `xpp_lock_timeout_minutes` | number string | Default `"5"` |
| `xpp_last_activity` | timestamp string | Updated on user interaction |

---

## Architecture: Gate Components

```
App.tsx
└── Providers
    └── SetupGate          ← blocks if xpp_setup_complete missing
        └── AuthGate       ← blocks if locked
            └── NuqsAdapter
                └── RouterProvider
```

`SetupGate` and `AuthGate` are composable wrappers. The router and all feature pages only render after both gates clear. No API calls fire before setup is complete.

---

## SetupGate + Onboarding Wizard

`SetupGate` reads `xpp_setup_complete` on mount. Missing → renders `SetupWizard` full-screen. Present → renders children.

### Wizard Steps (uses existing `Stepper` component)

**Step 1 — Connect**

- Input: GAS Script URL
  - Help text: *"Google Apps Script → Deploy → New deployment → Web app → Copy the URL"*
- Input: Spreadsheet ID
  - Help text: *"Copy the ID from your sheet URL: `docs.google.com/spreadsheets/d/`**[ID]**`/edit`"*
- "Test connection" button → fires real `gasAdapter.getAll('currencies')` request
  - Shows spinner during request
  - Success: green checkmark, Next enabled
  - Error: red message with raw error, retry available
- Writes `xpp_gas_url` and `xpp_spreadsheet_id` to localStorage on success

**Step 2 — Secure**

- Input: Email (stored as-is, used only for forgot-passkey confirmation)
- WebAuthn offered first if `PublicKeyCredential` available:
  - Button: "Set up Face ID / fingerprint / passkey"
  - On success: stores credential ID → `xpp_auth_credential_id`, sets `xpp_auth_method = "webauthn"`
- "Use PIN instead" fallback (always available):
  - 4–6 digit PIN input + confirm field
  - PIN hashed with SHA-256 → stored in `xpp_auth_pin_hash`
  - Sets `xpp_auth_method = "pin"`

**Step 3 — Base Currency + Theme**

- Searchable dropdown: full ISO 4217 list (code + name + symbol)
- Selected currency created via `gasAdapter.create('currencies', {..., isBase: true})`
- Theme toggle: Light / Dark (reuses `useTheme` hook)
- Can't proceed until currency is created successfully

**Step 4 — First Account**

- Reuses existing `AccountForm` component
- Creates account via `gasAdapter.create('accounts', ...)`
- On success: sets `xpp_setup_complete = "true"` → `SetupGate` unmounts → app loads

---

## AuthGate + Lock Screen

`AuthGate` reads `xpp_auth_method`. Maintains `AuthContext` with `{ isLocked, lock, unlock }`.

### Initial Load Behavior

- App always starts locked (sets `isLocked = true` on mount)
- Shows `LockScreen` immediately

### LockScreen

**WebAuthn mode:**
- Single "Unlock" button → calls `navigator.credentials.get()` with stored credential ID
- On success: `unlock()`
- On failure: falls back to PIN entry

**PIN mode:**
- Dot-style PIN input (no visible digits)
- On submit: SHA-256 hash compared to `xpp_auth_pin_hash`
- Match → `unlock()`
- No match → shake animation, clear input

**Forgot passkey link (both modes):**
- Shows: `"Registered email: e***i@gmail.com"`
- Confirm button: clears `xpp_auth_*` keys + `xpp_setup_complete`
- Redirects to full re-setup (SetupGate takes over)

---

## Lock System

### Manual Lock

- Lock icon button in `Header` (top-right area)
- Calls `lock()` from `AuthContext`
- Instantly shows `LockScreen`, blocks all navigation

### Auto-lock on Inactivity

`useActivityTracker` hook:
- Listens: `mousemove`, `keydown`, `touchstart`, `click` on `window`
- Updates `xpp_last_activity` timestamp on each event (throttled to 1/sec)

`useVisibilityChange` hook:
- Listens: `document.visibilitychange`
- On tab/app becoming visible: checks `Date.now() - xpp_last_activity` vs `xpp_lock_timeout_minutes * 60000`
- Elapsed > timeout → calls `lock()`

Also runs a 30-second interval check while app is visible for the same elapsed check.

### Auto-lock Settings

New field in System Settings page: "Auto-lock after X minutes of inactivity" (number input, min 1, max 60, default 5). Writes to `xpp_lock_timeout_minutes`.

---

## Changes to Existing Files

| File | Change |
|------|--------|
| `src/app/App.tsx` | Wrap with `<SetupGate><AuthGate>` |
| `src/lib/gas-adapter.ts` | Read `localStorage.getItem('xpp_gas_url')` first, fall back to `import.meta.env.VITE_GAS_URL` |
| `src/components/layout/Header.tsx` | Add lock icon button, call `lock()` from `AuthContext` |
| `src/pages/settings/system.tsx` | Add auto-lock timeout field |

---

## New Files

```
src/auth/
  AuthContext.tsx
  AuthGate.tsx
  SetupGate.tsx
  useActivityTracker.ts
  lock-screen/
    LockScreen.tsx
    ForgotPasskey.tsx
  setup/
    SetupWizard.tsx
    steps/
      ConnectStep.tsx
      SecureStep.tsx
      CurrencyStep.tsx
      AccountStep.tsx

src/lib/
  auth.ts               # sha256(), webauthn register/verify helpers
  iso-currencies.ts     # static ISO 4217 list (code, name, symbol)
```

---

## Security Notes

- PIN stored as SHA-256 hex only — never reversible
- WebAuthn credential lives in OS/browser secure enclave — never in localStorage
- "Forgot passkey" wipes all auth state — data in Google Sheets is unaffected
- `xpp_gas_url` in localStorage means anyone with DevTools can read it — acceptable for a personal app; the GAS URL is already semi-public by nature
