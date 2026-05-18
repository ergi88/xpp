import { Page, PageHeader, FormWrapper } from "@/components/shared";
import {
  AppearanceSettingsCard,
  AppUpdateCard,
  AuthenticationSettingsCard,
  BaseCurrencyCard,
  CurrencyRatesCard,
  RepairSheetCard,
  ResetSetupCard,
  SecuritySettingsCard,
  SpreadsheetCard,
} from "./sections";

export default function SystemSettingsPage() {
  return (
    <Page title="System Settings">
      <PageHeader title="System" />
      <FormWrapper>
        <div className="space-y-6">
          <AppearanceSettingsCard />
          <SecuritySettingsCard />
          <AuthenticationSettingsCard />
          <BaseCurrencyCard />
          <CurrencyRatesCard />
          <SpreadsheetCard />
          <RepairSheetCard />
          <AppUpdateCard />
          <ResetSetupCard />
        </div>
      </FormWrapper>
    </Page>
  );
}
