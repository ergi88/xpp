import type { CategoryFormData, CurrencyFormData, TagFormData } from "@/types";

export type SeedPresetId = "database" | "currencies" | "categories" | "tags";

export type SeedPresetItem =
  | { kind: "currency"; data: CurrencyFormData }
  | { kind: "category"; data: CategoryFormData }
  | { kind: "tag"; data: TagFormData };

export interface SeedPreset {
  id: SeedPresetId;
  title: string;
  description: string;
  items: SeedPresetItem[];
}

const currencies: CurrencyFormData[] = [
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    decimals: 2,
    isBase: true,
    rate: 1,
  },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, rate: 1.08 },
  { code: "ALL", name: "Albanian Lek", symbol: "L", decimals: 2, rate: 0.011 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, rate: 1.27 },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", decimals: 2, rate: 1.12 },
];

const categories: CategoryFormData[] = [
  { name: "Food & Groceries", type: "expense", icon: "🛒", color: "#4ade80" },
  { name: "Transport", type: "expense", icon: "🚗", color: "#60a5fa" },
  { name: "Housing", type: "expense", icon: "🏠", color: "#a78bfa" },
  { name: "Utilities", type: "expense", icon: "⚡", color: "#fbbf24" },
  { name: "Healthcare", type: "expense", icon: "🏥", color: "#f87171" },
  { name: "Entertainment", type: "expense", icon: "🎮", color: "#f472b6" },
  { name: "Shopping", type: "expense", icon: "🛍️", color: "#2dd4bf" },
  { name: "Education", type: "expense", icon: "🎓", color: "#818cf8" },
  {
    name: "Restaurants & Cafes",
    type: "expense",
    icon: "🍽️",
    color: "#fb923c",
  },
  { name: "Subscriptions", type: "expense", icon: "🔄", color: "#c084fc" },
  { name: "Personal Care", type: "expense", icon: "✨", color: "#e879f9" },
  { name: "Gifts", type: "expense", icon: "🎁", color: "#fb7185" },
  { name: "Travel", type: "expense", icon: "✈️", color: "#38bdf8" },
  { name: "Other Expenses", type: "expense", icon: "📌", color: "#94a3b8" },
  { name: "Salary", type: "income", icon: "💵", color: "#4ade80" },
  { name: "Freelance", type: "income", icon: "💻", color: "#60a5fa" },
  { name: "Investments", type: "income", icon: "📈", color: "#a78bfa" },
  { name: "Gifts Received", type: "income", icon: "🎀", color: "#f472b6" },
  { name: "Refunds", type: "income", icon: "↩️", color: "#2dd4bf" },
  { name: "Other Income", type: "income", icon: "💰", color: "#94a3b8" },
];

const tags: TagFormData[] = [
  { name: "Essential" },
  { name: "Optional" },
  { name: "Recurring" },
  { name: "One-time" },
  { name: "Business" },
  { name: "Personal" },
  { name: "Family" },
  { name: "Vacation" },
  { name: "Emergency" },
  { name: "Planned" },
];

export const seedPresets: SeedPreset[] = [
  {
    id: "database",
    title: "Database defaults",
    description: "Currencies, categories, and tags used by the seeders.",
    items: [
      ...currencies.map((data) => ({ kind: "currency" as const, data })),
      ...categories.map((data) => ({ kind: "category" as const, data })),
      ...tags.map((data) => ({ kind: "tag" as const, data })),
    ],
  },
  {
    id: "currencies",
    title: "CurrencySeeder",
    description: "Seed the default currency list.",
    items: currencies.map((data) => ({ kind: "currency" as const, data })),
  },
  {
    id: "categories",
    title: "CategorySeeder",
    description: "Seed income and expense categories.",
    items: categories.map((data) => ({ kind: "category" as const, data })),
  },
  {
    id: "tags",
    title: "TagSeeder",
    description: "Seed transaction tags.",
    items: tags.map((data) => ({ kind: "tag" as const, data })),
  },
];
