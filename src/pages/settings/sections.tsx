import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCurrencies,
  useSetBaseCurrency,
  useSettings,
  useUpdateSettings,
} from "@/hooks";
import { useTheme } from "@/hooks/use-theme";
import { ExternalLink, Fingerprint, Loader2, CheckCircle2 } from "lucide-react";
import {
  STORAGE_KEYS,
  sha256,
  registerWebAuthn,
  isWebAuthnSupported,
  clearAuthStorage,
} from "@/lib/auth";
import { settingsApi } from "@/api";

const pinSchema = z
  .object({
    email: z.string().email("Must be a valid email"),
    pin: z
      .string()
      .min(4, "PIN must be 4-6 digits")
      .max(6)
      .regex(/^\d+$/, "Digits only"),
    pinConfirm: z.string(),
  })
  .refine((d) => d.pin === d.pinConfirm, {
    message: "PINs do not match",
    path: ["pinConfirm"],
  });

type PinFormData = z.infer<typeof pinSchema>;

export function SecuritySetupForm() {
  const existingMethod = localStorage.getItem(STORAGE_KEYS.AUTH_METHOD);
  const existingEmail = localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL) ?? "";

  const [pinMode, setPinMode] = useState(!isWebAuthnSupported());
  const [webAuthnLoading, setWebAuthnLoading] = useState(false);
  const [webAuthnError, setWebAuthnError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PinFormData>({
    resolver: zodResolver(pinSchema),
    defaultValues: { email: existingEmail },
  });

  const saveEmail = (email: string) => {
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, email);
    settingsApi.syncAuthEmailToSheet(email);
  };

  const handleWebAuthn = async () => {
    const { email } = getValues();
    if (!email) return;
    setWebAuthnLoading(true);
    setWebAuthnError("");
    try {
      saveEmail(email);
      const credentialId = await registerWebAuthn(email);
      localStorage.setItem(STORAGE_KEYS.AUTH_CREDENTIAL_ID, credentialId);
      localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, "webauthn");
      setSuccess(true);
    } catch (err) {
      setWebAuthnError(
        err instanceof Error ? err.message : "WebAuthn setup failed",
      );
    } finally {
      setWebAuthnLoading(false);
    }
  };

  const onPinSubmit = async (data: PinFormData) => {
    saveEmail(data.email);
    const hash = await sha256(data.pin);
    localStorage.setItem(STORAGE_KEYS.AUTH_PIN_HASH, hash);
    localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, "pin");
    setSuccess(true);
  };

  if (success) {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertDescription>Security method saved successfully.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {existingMethod && (
        <p className="text-sm text-muted-foreground">
          Current method:{" "}
          <span className="font-medium text-foreground">
            {existingMethod === "webauthn" ? "Biometrics / Passkey" : "PIN"}
          </span>
          . Set up a new one below to replace it.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="sec-email">Email</Label>
        <Input
          id="sec-email"
          type="email"
          placeholder="you@example.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Used to verify identity if you forget your passkey. Stored in your
          sheet.
        </p>
      </div>

      {!pinMode ? (
        <div className="flex flex-col gap-3">
          {webAuthnError && (
            <Alert variant="destructive">
              <AlertDescription>{webAuthnError}</AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            onClick={handleWebAuthn}
            disabled={webAuthnLoading}
            className="gap-2"
          >
            {webAuthnLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            Set up Face ID / fingerprint / passkey
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline self-start"
            onClick={() => setPinMode(true)}
          >
            Use PIN instead
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onPinSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="sec-pin">PIN (4-6 digits)</Label>
            <Input
              id="sec-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="******"
              {...register("pin")}
            />
            {errors.pin && (
              <p className="text-xs text-destructive">{errors.pin.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sec-pin-confirm">Confirm PIN</Label>
            <Input
              id="sec-pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="******"
              {...register("pinConfirm")}
            />
            {errors.pinConfirm && (
              <p className="text-xs text-destructive">
                {errors.pinConfirm.message}
              </p>
            )}
          </div>
          <Button type="submit">Save PIN</Button>
          {isWebAuthnSupported() && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline self-start"
              onClick={() => setPinMode(false)}
            >
              Use biometrics instead
            </button>
          )}
        </form>
      )}
    </div>
  );
}

export function AppearanceSettingsCard() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { theme, setTheme } = useTheme();

  const handleHideAmountsChange = (checked: boolean) => {
    updateSettings.mutate({ hide_amounts: checked });
  };

  const handleThemeChange = (value: string) => {
    if (value === "light" || value === "dark") {
      setTheme(value);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Control how the app looks and how sensitive values are shown
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="theme" className="text-base font-medium">
              Theme
            </Label>
            <p className="text-sm text-muted-foreground">
              Choose between the light and dark application themes.
            </p>
          </div>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger id="theme" className="w-full sm:w-44">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-5 w-8" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="hide-amounts" className="text-base font-medium">
                Hide amounts
              </Label>
              <p className="text-sm text-muted-foreground">
                Blur balances and other hideable totals throughout the app.
              </p>
            </div>
            <Switch
              id="hide-amounts"
              checked={settings?.hide_amounts ?? false}
              onCheckedChange={handleHideAmountsChange}
              disabled={updateSettings.isPending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MobileFooterSettingsCard() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const handleFooterEnabled = (checked: boolean) => {
    updateSettings.mutate({ mobile_footer_enabled: checked });
  };

  const handleFooterLabels = (checked: boolean) => {
    updateSettings.mutate({ mobile_footer_labels: checked });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mobile navigation</CardTitle>
        <CardDescription>
          Control the bottom navigation bar shown on small screens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label
                  htmlFor="footer-enabled"
                  className="text-base font-medium"
                >
                  Show mobile footer
                </Label>
                <p className="text-sm text-muted-foreground">
                  Keep the main navigation within thumb reach.
                </p>
              </div>
              <Switch
                id="footer-enabled"
                checked={settings?.mobile_footer_enabled ?? true}
                onCheckedChange={handleFooterEnabled}
                disabled={updateSettings.isPending}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label
                  htmlFor="footer-labels"
                  className="text-base font-medium"
                >
                  Show labels
                </Label>
                <p className="text-sm text-muted-foreground">
                  Display text labels under navigation icons.
                </p>
              </div>
              <Switch
                id="footer-labels"
                checked={settings?.mobile_footer_labels ?? true}
                onCheckedChange={handleFooterLabels}
                disabled={
                  updateSettings.isPending ||
                  !(settings?.mobile_footer_enabled ?? true)
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SecuritySettingsCard() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Configure auto-lock behavior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-5 w-8" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="lock-enabled" className="text-base font-medium">
                Lock screen
              </Label>
              <p className="text-sm text-muted-foreground">
                Require authentication when the app is opened or after
                inactivity.
              </p>
            </div>
            <Switch
              id="lock-enabled"
              checked={settings?.lock_enabled ?? true}
              onCheckedChange={(checked) =>
                updateSettings.mutate({ lock_enabled: checked })
              }
              disabled={updateSettings.isPending}
            />
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="lockTimeout" className="text-base font-medium">
              Auto-lock timeout
            </Label>
            <p className="text-sm text-muted-foreground">
              Lock the app after this many minutes of inactivity (1-60).
            </p>
          </div>
          <Input
            id="lockTimeout"
            type="number"
            min={1}
            max={60}
            className="w-24"
            defaultValue={settings?.lock_timeout_minutes ?? 5}
            disabled={!(settings?.lock_enabled ?? true)}
            onBlur={(e) => {
              const val = Math.min(60, Math.max(1, Number(e.target.value)));
              updateSettings.mutate({ lock_timeout_minutes: val });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function AuthenticationSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
        <CardDescription>Set up or change your passkey or PIN</CardDescription>
      </CardHeader>
      <CardContent>
        <SecuritySetupForm />
      </CardContent>
    </Card>
  );
}

export function BaseCurrencyCard() {
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();
  const setBaseCurrency = useSetBaseCurrency();

  const baseCurrencyId = currencies?.find((currency) => currency.isBase)?.id;

  const handleBaseCurrencyChange = (currencyId: string) => {
    if (currencyId === baseCurrencyId) return;
    setBaseCurrency.mutate(currencyId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base Currency</CardTitle>
        <CardDescription>
          Change the primary currency used across the app without storing a
          duplicate settings value
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currenciesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full sm:w-60" />
          </div>
        ) : currencies && currencies.length > 0 ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="base-currency" className="text-base font-medium">
                Base currency
              </Label>
              <p className="text-sm text-muted-foreground">
                This uses the same base-currency switch as the Currencies page.
              </p>
            </div>
            <Select
              value={baseCurrencyId}
              onValueChange={handleBaseCurrencyChange}
              disabled={setBaseCurrency.isPending}
            >
              <SelectTrigger id="base-currency" className="w-full sm:w-60">
                <SelectValue placeholder="Select base currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.id} value={String(currency.id)}>
                    {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No currencies are available yet. Add one from the Currencies page
            first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CurrencyRatesCard() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const handleAutoUpdateChange = (checked: boolean) => {
    updateSettings.mutate({ auto_update_currencies: checked });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency Rates</CardTitle>
        <CardDescription>
          Configure how currency exchange rates are managed
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-5 w-8" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-update" className="text-base font-medium">
                Auto-update currency rates
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, currency rates are updated daily from an external
                API. Manual rate editing is disabled.
              </p>
            </div>
            <Switch
              id="auto-update"
              checked={settings?.auto_update_currencies ?? true}
              onCheckedChange={handleAutoUpdateChange}
              disabled={updateSettings.isPending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SpreadsheetCard() {
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${import.meta.env.APP_SPREADSHEET_ID}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spreadsheet</CardTitle>
        <CardDescription>Access your data spreadsheet</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="gap-2">
          <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer">
            Open Spreadsheet
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AppUpdateCard() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const handleForceRefresh = async () => {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Update</CardTitle>
        <CardDescription>
          {needRefresh
            ? "A new version is ready to install."
            : "Manually refresh the app to pick up the latest version."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-3 flex-wrap">
        {needRefresh && (
          <Button onClick={() => updateServiceWorker(true)} className="gap-2">
            <span>Install update</span>
          </Button>
        )}
        <Button variant="outline" onClick={handleForceRefresh} className="gap-2">
          Force refresh
        </Button>
      </CardContent>
    </Card>
  );
}

export function ResetSetupCard() {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle>Reset Setup</CardTitle>
        <CardDescription>
          Clears all local app data and restarts the setup wizard. Your
          spreadsheet data is not affected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={() => {
            clearAuthStorage();
            localStorage.removeItem("xpp_settings");
            window.location.reload();
          }}
        >
          Reset &amp; restart setup
        </Button>
      </CardContent>
    </Card>
  );
}
