import { Page, PageHeader, FormWrapper } from "@/components/shared";
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
import { ExternalLink } from "lucide-react";

export default function SystemSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();
  const updateSettings = useUpdateSettings();
  const setBaseCurrency = useSetBaseCurrency();
  const { theme, setTheme } = useTheme();

  const handleAutoUpdateChange = (checked: boolean) => {
    updateSettings.mutate({ auto_update_currencies: checked });
  };

  const handleHideAmountsChange = (checked: boolean) => {
    updateSettings.mutate({ hide_amounts: checked });
  };

  const handleThemeChange = (value: string) => {
    if (value === "light" || value === "dark") {
      setTheme(value);
    }
  };

  const baseCurrencyId = currencies?.find((currency) => currency.isBase)?.id;

  const handleBaseCurrencyChange = (currencyId: string) => {
    if (currencyId === baseCurrencyId) return;
    setBaseCurrency.mutate(currencyId);
  };

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${import.meta.env.APP_SPREADSHEET_ID}`;

  return (
    <Page title="System Settings">
      <PageHeader title="System" description="Configure system settings" />

      <FormWrapper>
        <div className="space-y-6">
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
                    <Label
                      htmlFor="hide-amounts"
                      className="text-base font-medium"
                    >
                      Hide amounts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Blur balances and other hideable totals throughout the
                      app.
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

          <Card>
            <CardHeader>
              <CardTitle>Base Currency</CardTitle>
              <CardDescription>
                Change the primary currency used across the app without storing
                a duplicate settings value
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
                    <Label
                      htmlFor="base-currency"
                      className="text-base font-medium"
                    >
                      Base currency
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      This uses the same base-currency switch as the Currencies
                      page.
                    </p>
                  </div>
                  <Select
                    value={baseCurrencyId}
                    onValueChange={handleBaseCurrencyChange}
                    disabled={setBaseCurrency.isPending}
                  >
                    <SelectTrigger
                      id="base-currency"
                      className="w-full sm:w-60"
                    >
                      <SelectValue placeholder="Select base currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.id} value={String(currency.id)}>
                          {currency.code} · {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No currencies are available yet. Add one from the Currencies
                  page first.
                </p>
              )}
            </CardContent>
          </Card>

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
                    <Label
                      htmlFor="auto-update"
                      className="text-base font-medium"
                    >
                      Auto-update currency rates
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, currency rates are updated daily from an
                      external API. Manual rate editing is disabled.
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

          <Card>
            <CardHeader>
              <CardTitle>Spreadsheet</CardTitle>
              <CardDescription>Access your data spreadsheet</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Spreadsheet
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </FormWrapper>
    </Page>
  );
}
