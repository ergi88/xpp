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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/hooks";
import { ExternalLink } from "lucide-react";

export default function SystemSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const handleAutoUpdateChange = (checked: boolean) => {
    updateSettings.mutate({ auto_update_currencies: checked });
  };

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${import.meta.env.APP_SPREADSHEET_ID}`;

  return (
    <Page title="System Settings">
      <PageHeader title="System" description="Configure system settings" />

      <FormWrapper>
        <div className="space-y-6">
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
