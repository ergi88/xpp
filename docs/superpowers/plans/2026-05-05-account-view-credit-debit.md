# Account View & Credit/Debit Card Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a credit card account type with reversed balance display, card metadata (last 4 digits + expiry) for bank/credit accounts, and a per-account view page at `/accounts/:id` that shows stats, recent transactions, and a maintenance fee shortcut.

**Architecture:** Extend `Account` type and Zod schema with `credit` as a new `RegularAccountType`, plus optional `cardLastDigits`, `cardExpiry`, and `creditLimit` fields. The account view page fetches the account plus its transactions (using the existing `account_id` filter in `TransactionFilters`). Credit balance display is inverted at the UI layer only — no changes to transaction logic; credit `currentBalance` is stored negative (debt), displayed as absolute values with utilization.

**Tech Stack:** React, TypeScript, Zod, React Hook Form (`useWatch`), TanStack Query, React Router v6, shadcn/ui, Tailwind CSS

---

## File Map

**Modified:**
- `src/types/accounts.ts` — add `credit` to `AccountType`/`RegularAccountType`, add card/credit fields to `Account`
- `src/schemas/accounts.ts` — add `credit` enum value, card fields, credit limit with `superRefine`
- `src/constants/accounts.ts` — add credit type config with `CreditCard` icon
- `src/api/accounts.ts` — update `toAccount` mapper and `create`/`update` to persist new fields
- `src/components/features/accounts/AccountForm.tsx` — conditional card + credit limit fields via `useWatch`
- `src/components/features/accounts/index.ts` — export new components
- `src/pages/accounts/[id]/edit.tsx` — pass new defaultValues, change backLink to view page
- `src/components/features/accounts/columns.tsx` — wrap name cell in Link to view page
- `src/app/router.tsx` — add `/accounts/:id` route

**Created:**
- `src/components/features/accounts/AccountCard.tsx` — visual card for bank/credit with last4/expiry
- `src/components/features/accounts/AccountStats.tsx` — balance stats; credit shows used/available/limit + progress bar
- `src/pages/accounts/[id]/index.tsx` — AccountViewPage

---

## Task 1: Extend Account type and schema

**Files:**
- Modify: `src/types/accounts.ts`
- Modify: `src/schemas/accounts.ts`

- [ ] **Step 1: Update `src/types/accounts.ts`**

Replace the type definitions (keep all other interfaces unchanged):

```typescript
import { BaseEntity } from './api'
import { Currency } from './currencies'

export type AccountType = 'bank' | 'crypto' | 'cash' | 'debt' | 'credit'
export type RegularAccountType = 'bank' | 'crypto' | 'cash' | 'credit'

export interface Account extends BaseEntity {
  name: string
  type: AccountType
  currencyId: string
  initialBalance: number
  currentBalance: number
  isActive: boolean
  currency?: Currency
  cardLastDigits?: string
  cardExpiry?: string
  creditLimit?: number
}

export interface AccountsSummary {
  total_balance: number
  currency: string
  currency_code: string
  decimals: number
  accounts_count: number
}

export interface AccountsResponse {
  data: Account[]
  summary?: AccountsSummary
}

export interface BalanceHistorySeries {
  name: string
  type: string
  data: number[]
}

export interface BalanceHistoryResponse {
  dates: string[]
  series: BalanceHistorySeries[]
  currency: string
  decimals: number
}

export interface BalanceComparisonResponse {
  current: number
  previous: number | null
  currency: string
  decimals: number
}
```

- [ ] **Step 2: Replace `src/schemas/accounts.ts`**

```typescript
import { z } from "zod";

export const accountSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Maximum 255 characters"),

  type: z.enum(["bank", "crypto", "cash", "credit"], {
    error: "Please select account type",
  }),

  currency_id: z.string().min(1, "Please select currency"),

  initial_balance: z.coerce
    .number()
    .min(0, "Balance cannot be negative")
    .optional()
    .default(0),

  is_active: z.boolean().optional().default(true),

  card_last_digits: z
    .string()
    .length(4, "Must be exactly 4 digits")
    .regex(/^\d{4}$/, "Must be 4 numeric digits")
    .optional()
    .nullable(),

  card_expiry: z
    .string()
    .regex(/^\d{2}\/\d{2}$/, "Format must be MM/YY")
    .optional()
    .nullable(),

  credit_limit: z.coerce
    .number()
    .min(0, "Credit limit cannot be negative")
    .optional()
    .nullable(),
}).superRefine((data, ctx) => {
  if (data.type === 'credit' && !data.credit_limit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Credit limit is required for credit accounts',
      path: ['credit_limit'],
    })
  }
})

export type AccountFormData = z.infer<typeof accountSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/accounts.ts src/schemas/accounts.ts
git commit -m "feat(accounts): add credit type and card metadata fields to types and schema"
```

---

## Task 2: Update constants for credit type

**Files:**
- Modify: `src/constants/accounts.ts`

- [ ] **Step 1: Replace `src/constants/accounts.ts`**

```typescript
import { Landmark, Wallet, Bitcoin, HandCoins, CreditCard } from 'lucide-react'
import type { AccountType, RegularAccountType } from '@/types'

export interface AccountTypeConfig {
  icon: typeof Landmark
  label: string
  color: string
  bgColor: string
  textColor: string
}

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, AccountTypeConfig> = {
  bank: {
    icon: Landmark,
    label: 'Bank',
    color: 'bg-blue-100 text-blue-700',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
  },
  cash: {
    icon: Wallet,
    label: 'Cash',
    color: 'bg-green-100 text-green-700',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
  },
  crypto: {
    icon: Bitcoin,
    label: 'Crypto',
    color: 'bg-orange-100 text-orange-700',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-600',
  },
  debt: {
    icon: HandCoins,
    label: 'Debt',
    color: 'bg-purple-100 text-purple-700',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-600',
  },
  credit: {
    icon: CreditCard,
    label: 'Credit Card',
    color: 'bg-rose-100 text-rose-700',
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-600',
  },
}

export const REGULAR_ACCOUNT_TYPES: RegularAccountType[] = ['bank', 'cash', 'crypto', 'credit']

export const REGULAR_ACCOUNT_TYPE_CONFIG: Record<RegularAccountType, AccountTypeConfig> = {
  bank: ACCOUNT_TYPE_CONFIG.bank,
  cash: ACCOUNT_TYPE_CONFIG.cash,
  crypto: ACCOUNT_TYPE_CONFIG.crypto,
  credit: ACCOUNT_TYPE_CONFIG.credit,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/accounts.ts
git commit -m "feat(accounts): add credit card type to account type config"
```

---

## Task 3: Update API layer

**Files:**
- Modify: `src/api/accounts.ts`

- [ ] **Step 1: Update `toAccount` mapper**

Replace the `toAccount` function:

```typescript
function toAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Account['type'],
    currencyId: r.currency_id as string,
    initialBalance: Number(r.initial_balance ?? 0),
    currentBalance: Number(r.balance ?? 0),
    isActive: r.is_active === 'true' || r.is_active === true,
    createdAt: r.created_at as string | undefined,
    cardLastDigits: r.card_last_digits as string | undefined ?? undefined,
    cardExpiry: r.card_expiry as string | undefined ?? undefined,
    creditLimit: r.credit_limit != null ? Number(r.credit_limit) : undefined,
  }
}
```

- [ ] **Step 2: Update `accountsApi.create`**

Replace the `create` method:

```typescript
create: async (data: AccountFormData): Promise<Account> => {
  // Credit accounts store balance as negative (debt owed)
  const initialBal = data.type === 'credit'
    ? -(data.initial_balance ?? 0)
    : (data.initial_balance ?? 0)
  const r = await adapter.create('accounts', {
    id: crypto.randomUUID(),
    name: data.name,
    type: data.type,
    currency_id: data.currency_id,
    initial_balance: initialBal,
    balance: initialBal,
    is_active: String(data.is_active ?? true),
    created_at: new Date().toISOString(),
    card_last_digits: data.card_last_digits ?? null,
    card_expiry: data.card_expiry ?? null,
    credit_limit: data.credit_limit ?? null,
  })
  return toAccount(r)
},
```

- [ ] **Step 3: Update `accountsApi.update`**

Replace the `update` method:

```typescript
update: async (id: string | number, data: Partial<AccountFormData>): Promise<Account> => {
  const r = await adapter.update('accounts', String(id), {
    ...data,
    card_last_digits: data.card_last_digits ?? null,
    card_expiry: data.card_expiry ?? null,
    credit_limit: data.credit_limit ?? null,
  } as Record<string, unknown>)
  return toAccount(r)
},
```

- [ ] **Step 4: Commit**

```bash
git add src/api/accounts.ts
git commit -m "feat(accounts): update API mapper and CRUD to handle card metadata and credit limit"
```

---

## Task 4: Update AccountForm with conditional fields

**Files:**
- Modify: `src/components/features/accounts/AccountForm.tsx`

- [ ] **Step 1: Replace `src/components/features/accounts/AccountForm.tsx`**

```tsx
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountSchema, AccountFormData } from "@/schemas";
import { useCurrencies } from "@/hooks";
import { REGULAR_ACCOUNT_TYPE_CONFIG, REGULAR_ACCOUNT_TYPES } from "@/constants";
import type { RegularAccountType } from "@/types";
import { cn } from "@/lib/utils";
import { FormWrapper } from "@/components/shared/FormWrapper";

interface AccountFormProps {
  defaultValues?: Partial<AccountFormData>;
  onSubmit: (data: AccountFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function AccountForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: AccountFormProps) {
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "bank",
      currency_id: "",
      initial_balance: 0,
      is_active: true,
      card_last_digits: null,
      card_expiry: null,
      credit_limit: null,
      ...defaultValues,
    },
  });

  const accountType = useWatch({ control: form.control, name: "type" });
  const showCardFields = accountType === "bank" || accountType === "credit";
  const isCredit = accountType === "credit";

  return (
    <FormWrapper>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Account" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REGULAR_ACCOUNT_TYPES.map((type) => {
                      const config = REGULAR_ACCOUNT_TYPE_CONFIG[type as RegularAccountType];
                      const Icon = config.icon;
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("size-4", config.textColor)} />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={currenciesLoading}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies?.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id.toString()}>
                        <span className="font-mono">{currency.code}</span>
                        <span className="text-muted-foreground ml-2">
                          {currency.symbol} · {currency.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="initial_balance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isCredit ? "Initial Balance Owed" : "Initial Balance"}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0} placeholder="0.00" {...field} />
                </FormControl>
                <FormDescription>
                  {isCredit
                    ? "Amount already owed on this card (0 if starting fresh)"
                    : "Starting balance for this account"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {isCredit && (
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>Maximum credit available on this card</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {showCardFields && (
            <>
              <FormField
                control={form.control}
                name="card_last_digits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last 4 Digits</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1234"
                        maxLength={4}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormDescription>Last 4 digits of the card number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="card_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="MM/YY"
                        maxLength={5}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "")
                          if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2, 4)
                          field.onChange(v || null)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active</FormLabel>
                  <FormDescription>Inactive accounts are hidden from lists</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </form>
      </Form>
    </FormWrapper>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/accounts/AccountForm.tsx
git commit -m "feat(accounts): add conditional card fields and credit limit to AccountForm"
```

---

## Task 5: Update AccountEditPage

**Files:**
- Modify: `src/pages/accounts/[id]/edit.tsx`

- [ ] **Step 1: Replace `src/pages/accounts/[id]/edit.tsx`**

```tsx
import { useParams } from "react-router-dom";
import { FormPage } from "@/components/shared";
import { AccountForm } from "@/components/features/accounts";
import { useAccount, useUpdateAccount } from "@/hooks";

export default function AccountEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: account, isLoading } = useAccount(id!);
  const updateAccount = useUpdateAccount(`/accounts/${id}`);

  const defaultValues = account
    ? {
        name: account.name,
        type: account.type as "bank" | "crypto" | "cash" | "credit",
        currency_id: account.currencyId,
        initial_balance: account.type === 'credit'
          ? Math.abs(account.initialBalance)
          : account.initialBalance,
        is_active: account.isActive,
        card_last_digits: account.cardLastDigits ?? null,
        card_expiry: account.cardExpiry ?? null,
        credit_limit: account.creditLimit ?? null,
      }
    : undefined;

  return (
    <FormPage title="Edit Account" backLink={`/accounts/${id}`} isLoading={isLoading}>
      <AccountForm
        defaultValues={defaultValues}
        onSubmit={(data) => updateAccount.mutate({ id: id!, data })}
        isSubmitting={updateAccount.isPending}
        submitLabel="Save"
      />
    </FormPage>
  );
}
```

Note: `backLink` points to the account view page, not the list.
Note: `useUpdateAccount` now redirects to the view page after save.

- [ ] **Step 2: Commit**

```bash
git add "src/pages/accounts/[id]/edit.tsx"
git commit -m "feat(accounts): update edit page defaultValues for card/credit fields, back to view"
```

---

## Task 6: Create AccountCard component

**Files:**
- Create: `src/components/features/accounts/AccountCard.tsx`

- [ ] **Step 1: Create `src/components/features/accounts/AccountCard.tsx`**

```tsx
import { CreditCard, Landmark } from 'lucide-react'
import { Account } from '@/types'
import { cn } from '@/lib/utils'

interface AccountCardProps {
  account: Account
  className?: string
}

export function AccountCard({ account, className }: AccountCardProps) {
  if (!account.cardLastDigits && !account.cardExpiry) return null

  const isCredit = account.type === 'credit'
  const Icon = isCredit ? CreditCard : Landmark

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 text-white select-none',
        isCredit
          ? 'bg-gradient-to-br from-rose-500 to-rose-700'
          : 'bg-gradient-to-br from-blue-500 to-blue-700',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">
            {isCredit ? 'Credit Card' : 'Debit Card'}
          </p>
          <p className="mt-1 text-xl font-semibold">{account.name}</p>
        </div>
        <Icon className="size-8 opacity-80" />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <div>
          <p className="text-xs opacity-70 uppercase tracking-wider">Card Number</p>
          <p className="mt-1 font-mono text-lg tracking-widest">
            •••• •••• •••• {account.cardLastDigits ?? '????'}
          </p>
        </div>
        {account.cardExpiry && (
          <div className="text-right">
            <p className="text-xs opacity-70 uppercase tracking-wider">Expires</p>
            <p className="mt-1 font-mono">{account.cardExpiry}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/accounts/AccountCard.tsx
git commit -m "feat(accounts): add AccountCard visual component for bank/credit cards"
```

---

## Task 7: Create AccountStats component

**Files:**
- Create: `src/components/features/accounts/AccountStats.tsx`

- [ ] **Step 1: Create `src/components/features/accounts/AccountStats.tsx`**

Credit accounts: `currentBalance` is negative (debt owed). Display as absolute values.
`availableCredit = creditLimit + currentBalance` (since currentBalance is negative, this subtracts the debt).

```tsx
import { Account } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface AccountStatsProps {
  account: Account
}

function fmt(amount: number, currency?: { symbol: string; decimals: number }) {
  if (!currency) return Math.abs(amount).toFixed(2)
  return `${currency.symbol}${Math.abs(amount).toFixed(currency.decimals)}`
}

export function AccountStats({ account }: AccountStatsProps) {
  const isCredit = account.type === 'credit'

  if (isCredit) {
    const used = Math.abs(account.currentBalance)
    const limit = account.creditLimit ?? 0
    const available = Math.max(0, limit - used)
    const utilization = limit > 0 ? (used / limit) * 100 : 0

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-2xl font-semibold text-rose-600">
                {fmt(used, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-semibold text-green-600">
                {fmt(available, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Limit</p>
              <p className="text-2xl font-semibold">
                {fmt(limit, account.currency)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div>
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Utilization</span>
            <span>{utilization.toFixed(1)}%</span>
          </div>
          <Progress
            value={utilization}
            className={cn(utilization > 80 && '[&>div]:bg-rose-500')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p
            className={cn(
              'text-2xl font-semibold',
              account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {account.currency?.symbol ?? ''}
            {account.currentBalance.toFixed(account.currency?.decimals ?? 2)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Initial Balance</p>
          <p className="text-2xl font-semibold text-muted-foreground">
            {fmt(account.initialBalance, account.currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/accounts/AccountStats.tsx
git commit -m "feat(accounts): add AccountStats with credit utilization progress bar"
```

---

## Task 8: Create AccountViewPage

**Files:**
- Create: `src/pages/accounts/[id]/index.tsx`

- [ ] **Step 1: Create `src/pages/accounts/[id]/index.tsx`**

`useTransactions` accepts `TransactionFilters` which includes `account_id`. The `Transaction` type has `account: Account` (not `accountId`), so filter server-side by passing `account_id` to the hook.

```tsx
import { useParams, Link } from 'react-router-dom'
import { Pencil, ArrowLeft, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccount, useTransactions, useCurrencies } from '@/hooks'
import { AccountCard } from '@/components/features/accounts/AccountCard'
import { AccountStats } from '@/components/features/accounts/AccountStats'
import { ACCOUNT_TYPE_CONFIG } from '@/constants'
import { cn } from '@/lib/utils'

export default function AccountViewPage() {
  const { id } = useParams<{ id: string }>()
  const { data: account, isLoading } = useAccount(id!)
  const { data: currencies } = useCurrencies()
  const { data: txnsData } = useTransactions({ account_id: id, per_page: 10 })

  const enrichedAccount = account && currencies
    ? { ...account, currency: currencies.find((c) => c.id.toString() === account.currencyId) }
    : account

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!enrichedAccount) {
    return <div className="p-6 text-muted-foreground">Account not found.</div>
  }

  const config = ACCOUNT_TYPE_CONFIG[enrichedAccount.type]
  const Icon = config.icon
  const transactions = txnsData?.data ?? []

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/accounts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className={cn('p-2 rounded-lg', config.color)}>
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{enrichedAccount.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className={config.color}>
                {config.label}
              </Badge>
              {enrichedAccount.currency && (
                <span className="text-sm text-muted-foreground font-mono">
                  {enrichedAccount.currency.code}
                </span>
              )}
              {!enrichedAccount.isActive && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link to={`/accounts/${id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Card visual — only renders if cardLastDigits or cardExpiry are set */}
      <AccountCard account={enrichedAccount} />

      {/* Balance / credit stats */}
      <AccountStats account={enrichedAccount} />

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/transactions?account_id=${id}`}>View all</Link>
          </Button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">{t.description ?? 'No description'}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
                <p
                  className={cn(
                    'font-mono font-medium',
                    t.type === 'income' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {t.type === 'income' ? '+' : '-'}
                  {enrichedAccount.currency?.symbol ?? ''}
                  {t.amount.toFixed(enrichedAccount.currency?.decimals ?? 2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring / Maintenance Fee */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Maintenance Fee</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/recurring/create">
              <Plus className="mr-1 size-4" />
              Set up
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a recurring expense to track monthly maintenance or subscription fees for this account.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/pages/accounts/[id]/index.tsx"
git commit -m "feat(accounts): add AccountViewPage with stats, card visual, and recent transactions"
```

---

## Task 9: Export new components and wire routing

**Files:**
- Modify: `src/components/features/accounts/index.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/components/features/accounts/columns.tsx`

- [ ] **Step 1: Add exports to `src/components/features/accounts/index.ts`**

Append to the file:

```typescript
export { AccountCard } from './AccountCard'
export { AccountStats } from './AccountStats'
```

- [ ] **Step 2: Add AccountViewPage to `src/app/router.tsx`**

Add the lazy import (after `AccountEditPage`):

```typescript
const AccountViewPage = lazy(() => import('@/pages/accounts/[id]/index'))
```

Add route (insert between `accounts/create` and `accounts/:id/edit`):

```typescript
{ path: 'accounts/:id', element: withSuspense(AccountViewPage) },
```

Full accounts block becomes:
```typescript
{ path: 'accounts', element: withSuspense(AccountsPage) },
{ path: 'accounts/create', element: withSuspense(AccountCreatePage) },
{ path: 'accounts/:id', element: withSuspense(AccountViewPage) },
{ path: 'accounts/:id/edit', element: withSuspense(AccountEditPage) },
```

- [ ] **Step 3: Make account name cell link to view page in `src/components/features/accounts/columns.tsx`**

Update the `name` column cell. Add `Link` import at top if not present:

```typescript
import { Link } from 'react-router-dom'
```

Replace the name cell `return` block:

```tsx
return (
  <Link
    to={`/accounts/${row.original.id}`}
    className="flex items-center gap-3 hover:opacity-75 transition-opacity"
  >
    <div className={`p-2 rounded-lg ${config.color}`}>
      <Icon className="size-5" />
    </div>
    <div>
      <p className="font-medium">{row.original.name}</p>
      <p className="text-xs text-muted-foreground">
        {row.original.currency?.code ?? 'N/A'}
      </p>
    </div>
  </Link>
)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/features/accounts/index.ts src/app/router.tsx src/components/features/accounts/columns.tsx
git commit -m "feat(accounts): wire up AccountViewPage route, export components, link list to view"
```

---

## Task 10: TypeScript check and manual verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. Common issues to fix:
- `REGULAR_ACCOUNT_TYPES` now includes `'credit'` — any code casting it to the old union type will need updating
- `account.type` casts in the edit page must include `'credit'`
- `REGULAR_ACCOUNT_TYPE_CONFIG` used in AccountForm may need type assertion if the type narrowing fails

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual verification checklist**

1. `/accounts` list — click account name → navigates to `/accounts/:id`
2. Account view page loads: header, stats, recent transactions section visible
3. Create a `credit` account:
   - Credit limit field appears
   - Card fields (last 4 digits, expiry) appear
   - Credit limit field absent on `cash`/`crypto` types
4. Create a `bank` account:
   - Card fields (last 4 digits, expiry) appear
   - No credit limit field
5. View a credit account with card details set → card visual renders with gradient
6. View a credit account → stats show Used / Available / Limit + utilization bar
7. View a regular account → stats show Current Balance / Initial Balance
8. Edit button on view page → navigates to edit page
9. Save from edit page → redirects back to view page

- [ ] **Step 4: Fix any issues found, commit**

```bash
git add -p
git commit -m "fix(accounts): resolve issues from manual verification"
```
