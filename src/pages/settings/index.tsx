import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/shared";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { createCategoryColumns } from "@/components/features/categories";
import { createTagColumns } from "@/components/features/tags";
import { createCurrencyColumns } from "@/components/features/currencies";
import {
  useCategories,
  useCurrencies,
  useDeleteCategory,
  useDeleteCurrency,
  useDeleteTag,
  useSetBaseCurrency,
  useTags,
} from "@/hooks";
import {
  AppearanceSettingsCard,
  AuthenticationSettingsCard,
  BaseCurrencyCard,
  CurrencyRatesCard,
  MobileFooterSettingsCard,
  ResetSetupCard,
  SecuritySettingsCard,
  SpreadsheetCard,
} from "@/pages/settings/sections";
import { ImportSettingsSection } from "@/pages/settings/import";

const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "security", label: "Security" },
  { value: "organization", label: "Organization" },
  { value: "currencies", label: "Currencies" },
  { value: "data", label: "Data & Import" },
];

const TAB_ALIASES: Record<string, string> = {
  system: "general",
  import: "data",
};

const TAB_VALUES = SETTINGS_TABS.map((tab) => tab.value);

interface SettingsTableSectionProps<T> {
  title: string;
  description?: string;
  createLink?: string;
  createLabel?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function SettingsTableSection<T>({
  title,
  description,
  createLink,
  createLabel,
  search,
  data,
  columns,
  isLoading,
  emptyTitle,
  emptyDescription,
}: SettingsTableSectionProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {createLink && (
          <Button asChild>
            <Link to={createLink}>
              <Plus className="mr-2 h-4 w-4" />
              {createLabel ?? "Create"}
            </Link>
          </Button>
        )}
      </div>
      {search && (
        <Input
          type="search"
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder ?? `Search ${title.toLowerCase()}`}
          className="w-full sm:w-72"
        />
      )}
      <DataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        emptyTitle={emptyTitle ?? `No ${title.toLowerCase()} found`}
        emptyDescription={
          emptyDescription ??
          `Create your first ${title.toLowerCase().slice(0, -1)} to get started`
        }
        emptyAction={
          createLink ? (
            <Button asChild>
              <Link to={createLink}>
                <Plus className="mr-2 size-4" />
                {createLabel ?? "Create"}
              </Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

function CategoriesSection() {
  const [search, setSearch] = useState("");
  const { data: categories, isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();
  const isReadOnly = false;

  const typeCounts = useMemo(
    () => ({
      income: categories?.filter((c) => c.type === "income").length ?? 0,
      expense: categories?.filter((c) => c.type === "expense").length ?? 0,
    }),
    [categories],
  );

  const columns = createCategoryColumns(
    (id) => deleteCategory.mutate(id),
    typeCounts,
    isReadOnly,
  );

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories ?? [];

    return (categories ?? []).filter((c) => {
      const name = c.name ?? "";
      const type = c.type ?? "";
      return [name, type].some((v) => v.toLowerCase().includes(q));
    });
  }, [search, categories]);

  return (
    <SettingsTableSection
      title="Categories"
      description="Manage income and expense categories"
      createLink="/categories/create"
      createLabel="New Category"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search categories",
      }}
      data={filteredCategories}
      columns={columns}
      isLoading={isLoading}
    />
  );
}

function TagsSection() {
  const [search, setSearch] = useState("");
  const { data: tags, isLoading } = useTags();
  const deleteTag = useDeleteTag();
  const isReadOnly = false;

  const columns = createTagColumns((id) => deleteTag.mutate(id), isReadOnly);

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags ?? [];

    return (tags ?? []).filter((t) => (t.name ?? "").toLowerCase().includes(q));
  }, [search, tags]);

  return (
    <SettingsTableSection
      title="Tags"
      description="Organize transactions with tags"
      createLink="/tags/create"
      createLabel="New Tag"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search tags",
      }}
      data={filteredTags}
      columns={columns}
      isLoading={isLoading}
      emptyTitle="No tags found"
      emptyDescription="Create your first tag to organize transactions"
    />
  );
}

function CurrenciesSection() {
  const [search, setSearch] = useState("");
  const { data: currencies, isLoading } = useCurrencies();
  const deleteCurrency = useDeleteCurrency();
  const setBaseCurrency = useSetBaseCurrency();
  const isReadOnly = false;

  const columns = createCurrencyColumns({
    onDelete: (id) => deleteCurrency.mutate(id),
    onSetBase: (id) => setBaseCurrency.mutate(id),
    isSettingBase: setBaseCurrency.isPending,
    currencyCount: currencies?.length ?? 0,
    isReadOnly,
  });

  const filteredCurrencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currencies ?? [];

    return (currencies ?? []).filter((c) => {
      const code = c.code ?? "";
      const name = c.name ?? "";
      return [code, name].some((v) => v.toLowerCase().includes(q));
    });
  }, [search, currencies]);

  return (
    <SettingsTableSection
      title="Currencies"
      description="Manage currencies and exchange rates"
      createLink="/currencies/create"
      createLabel="New Currency"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search currencies",
      }}
      data={filteredCurrencies}
      columns={columns}
      isLoading={isLoading}
    />
  );
}

function OrganizationTab() {
  const [active, setActive] = useState("categories");

  return (
    <Tabs value={active} onValueChange={setActive} className="space-y-4">
      <TabsList className="h-auto flex-wrap md:flex-nowrap md:h-9 md:w-fit">
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="tags">Tags</TabsTrigger>
      </TabsList>
      <TabsContent value="categories">
        <CategoriesSection />
      </TabsContent>
      <TabsContent value="tags">
        <TagsSection />
      </TabsContent>
    </Tabs>
  );
}

function CurrenciesTab() {
  return (
    <div className="space-y-6">
      <BaseCurrencyCard />
      <CurrencyRatesCard />
      <CurrenciesSection />
    </div>
  );
}

function GeneralTab() {
  return (
    <div className="space-y-6">
      <SpreadsheetCard />
      <ResetSetupCard />
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="space-y-6">
      <AppearanceSettingsCard />
      <MobileFooterSettingsCard />
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-6">
      <SecuritySettingsCard />
      <AuthenticationSettingsCard />
    </div>
  );
}

function DataTab() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Import Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Import transactions from a CSV file or bulk seed default reference
          data.
        </p>
      </div>
      <ImportSettingsSection />
    </div>
  );
}

export default function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const resolved = TAB_ALIASES[tab ?? ""] ?? tab ?? "general";
  const activeTab = TAB_VALUES.includes(resolved) ? resolved : "general";

  useEffect(() => {
    if (!tab) return;
    const alias = TAB_ALIASES[tab];
    if (alias) {
      navigate(alias === "general" ? "/settings" : `/settings/${alias}`, {
        replace: true,
      });
      return;
    }
    if (!TAB_VALUES.includes(tab)) {
      navigate("/settings", { replace: true });
    }
  }, [tab, navigate]);

  const handleTabChange = (value: string) => {
    navigate(value === "general" ? "/settings" : `/settings/${value}`);
  };

  return (
    <Page title="Settings">
      <PageHeader
        title="Settings"
        description="Control your preferences and manage supporting data"
      />
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap md:flex-nowrap md:h-9 md:w-fit">
          {SETTINGS_TABS.map((tabItem) => (
            <TabsTrigger key={tabItem.value} value={tabItem.value}>
              {tabItem.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="organization">
          <OrganizationTab />
        </TabsContent>
        <TabsContent value="currencies">
          <CurrenciesTab />
        </TabsContent>
        <TabsContent value="data">
          <DataTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
