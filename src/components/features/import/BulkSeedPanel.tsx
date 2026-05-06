import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { categoriesApi, currenciesApi, tagsApi } from "@/api";
import { useCategories, useCurrencies, useTags } from "@/hooks";
import type { Category, Currency, Tag } from "@/types";
import {
  seedPresets,
  type SeedPreset,
  type SeedPresetItem,
} from "./bulk-seed-presets";

type SeedSummary = {
  created: number;
  updated: number;
  skipped: number;
};

function currencyKey(currency: Currency) {
  return currency.code.toUpperCase();
}

function categoryKey(category: Category) {
  return `${category.name.toLowerCase()}::${category.type}`;
}

function tagKey(tag: Tag) {
  return tag.name.toLowerCase();
}

export function BulkSeedPanel() {
  const queryClient = useQueryClient();
  const currenciesQuery = useCurrencies();
  const categoriesQuery = useCategories();
  const tagsQuery = useTags();

  const existing = useMemo(
    () => ({
      currencies: new Map(
        (currenciesQuery.data ?? []).map((currency) => [
          currencyKey(currency),
          currency,
        ]),
      ),
      categories: new Map(
        (categoriesQuery.data ?? []).map((category) => [
          categoryKey(category),
          category,
        ]),
      ),
      tags: new Map((tagsQuery.data ?? []).map((tag) => [tagKey(tag), tag])),
    }),
    [categoriesQuery.data, currenciesQuery.data, tagsQuery.data],
  );

  const seedMutation = useMutation({
    mutationFn: async (preset: SeedPreset) => {
      const summary: SeedSummary = { created: 0, updated: 0, skipped: 0 };

      for (const item of preset.items) {
        const result = await seedItem(item, existing);
        summary.created += result.created;
        summary.updated += result.updated;
        summary.skipped += result.skipped;
      }

      return summary;
    },
    onSuccess: async (summary, preset) => {
      await queryClient.invalidateQueries({ queryKey: ["currencies"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success(
        `${preset.title}: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to seed preset");
    },
  });

  const seedAllMutation = useMutation({
    mutationFn: async () => {
      const summary: SeedSummary = { created: 0, updated: 0, skipped: 0 };

      for (const preset of seedPresets) {
        for (const item of preset.items) {
          const result = await seedItem(item, existing);
          summary.created += result.created;
          summary.updated += result.updated;
          summary.skipped += result.skipped;
        }
      }

      return summary;
    },
    onSuccess: async (summary) => {
      await queryClient.invalidateQueries({ queryKey: ["currencies"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success(
        `Database defaults: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to seed defaults");
    },
  });

  const isLoading =
    currenciesQuery.isLoading ||
    categoriesQuery.isLoading ||
    tagsQuery.isLoading ||
    seedMutation.isPending ||
    seedAllMutation.isPending;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>Bulk Add Presets</CardTitle>
          <Badge variant="secondary">Seeder-backed</Badge>
        </div>
        <CardDescription>
          Use the same defaults as the Laravel seeders to bulk create
          currencies, categories, and tags in this app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          {seedPresets.map((preset) => (
            <div key={preset.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{preset.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {preset.description}
                  </p>
                </div>
                <Badge variant="outline">{preset.items.length} items</Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {describePreset(preset).map((label) => (
                  <span key={label} className="rounded-full bg-muted px-2 py-1">
                    {label}
                  </span>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => seedMutation.mutate(preset)}
                disabled={isLoading}
              >
                Seed {preset.title}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Need everything at once?</p>
            <p className="text-sm text-muted-foreground">
              Run the Database defaults preset to seed currencies, categories,
              and tags together.
            </p>
          </div>
          <Button onClick={() => seedAllMutation.mutate()} disabled={isLoading}>
            Seed all defaults
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          DemoSeeder is not wired here because it depends on creating demo
          accounts, transactions, budgets, and automation rules as a separate
          backend flow.
        </p>
      </CardContent>
    </Card>
  );
}

async function seedItem(
  item: SeedPresetItem,
  existing: {
    currencies: Map<string, Currency>;
    categories: Map<string, Category>;
    tags: Map<string, Tag>;
  },
): Promise<SeedSummary> {
  if (item.kind === "currency") {
    const currency = existing.currencies.get(item.data.code.toUpperCase());
    if (!currency) {
      await currenciesApi.create(item.data);
      return { created: 1, updated: 0, skipped: 0 };
    }

    await currenciesApi.update(currency.id, item.data);
    return { created: 0, updated: 1, skipped: 0 };
  }

  if (item.kind === "category") {
    const key = `${item.data.name.toLowerCase()}::${item.data.type}`;
    const category = existing.categories.get(key);
    if (!category) {
      await categoriesApi.create(item.data);
      return { created: 1, updated: 0, skipped: 0 };
    }

    await categoriesApi.update(category.id, item.data);
    return { created: 0, updated: 1, skipped: 0 };
  }

  const tag = existing.tags.get(item.data.name.toLowerCase());
  if (!tag) {
    await tagsApi.create(item.data);
    return { created: 1, updated: 0, skipped: 0 };
  }

  await tagsApi.update(tag.id, item.data);
  return { created: 0, updated: 1, skipped: 0 };
}

function describePreset(preset: SeedPreset): string[] {
  const kinds = new Set(preset.items.map((item) => item.kind));
  return Array.from(kinds).map((kind) => {
    switch (kind) {
      case "currency":
        return "Currencies";
      case "category":
        return "Categories";
      case "tag":
        return "Tags";
    }
  });
}
