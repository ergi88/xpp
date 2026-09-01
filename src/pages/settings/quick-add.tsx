import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccounts, useCategories, useTags } from "@/hooks";
import { appHost, appLink, type LinkScheme } from "@/lib/app-links";
import { Check, Copy, Globe, Link2, ListOrdered, Smartphone } from "lucide-react";

interface QuickAddParam {
  name: string;
  aliases?: string[];
  required?: string;
  summary: string;
  accepts: string[];
  note?: string;
}

const PARAMS: QuickAddParam[] = [
  {
    name: "amount",
    summary: "How much. The sign is dropped — use type for direction.",
    accepts: ["222", "12.50", "€1.234,56", "1,234.56", "-40"],
    note: "A dot is always a decimal point. A comma is one only when it is the single separator with 1–2 digits behind it, so 1,50 is 1.50 but 1,500 is 1500.",
  },
  {
    name: "description",
    aliases: ["note"],
    summary: "Free text, trimmed to 500 characters.",
    accepts: ["Coffee", "Weekly shop"],
  },
  {
    name: "date",
    summary: "Defaults to today when omitted.",
    accepts: [
      "2026-05-02",
      "02/05/2026",
      "2.5.26",
      "today",
      "yesterday",
      "-3d",
      "2026-05-02T09:30:00Z",
    ],
    note: "Slash and dot dates are read day-first, the same way the app displays them.",
  },
  {
    name: "date_format",
    aliases: ["date_order"],
    summary: "Flips slash dates to month-first.",
    accepts: ["mdy", "dmy"],
    note: "Only matters when both halves are 12 or below — 25/12/2026 is unambiguous either way.",
  },
  {
    name: "type",
    summary: "Defaults to expense; inferred from the category when omitted.",
    accepts: ["expense", "income", "transfer"],
    note: "Aliases: out / debit / spend / cost mean expense, in / credit / deposit / earn mean income, move means transfer.",
  },
  {
    name: "category",
    aliases: ["category_id"],
    summary: "By name or id. Ignored for transfers.",
    accepts: ["food", "Food & Drinks", "groceries"],
    note: "Only categories of the resolved type are searched. Pass a category without a type and the type follows the category.",
  },
  {
    name: "account",
    aliases: ["account_id"],
    summary: "Which bank/wallet the money moves through.",
    accepts: ["Revolut", "bkt", "cash wallet"],
    note: "If you have exactly one account it is filled in automatically.",
  },
  {
    name: "to_account",
    aliases: ["to_account_id"],
    required: "transfers",
    summary: "Destination account. Required when type=transfer.",
    accepts: ["Savings", "Revolut"],
  },
  {
    name: "tags",
    aliases: ["tag", "tag_ids"],
    summary: "Comma-separated. Unknown tags are reported, never created.",
    accepts: ["work", "work,reimbursable"],
  },
  {
    name: "submit",
    aliases: ["save"],
    summary: "Save immediately instead of opening the form.",
    accepts: ["1", "true", "yes", "on"],
    note: "Needs amount, account and a category (or a destination account for transfers). If anything is missing or ambiguous, nothing is saved and the form opens with the reason.",
  },
];

type ListFormat = "lines" | "comma" | "json";

interface NamedItem {
  id: string;
  name: string;
}

const LIST_FORMAT_HINTS: Record<ListFormat, string> = {
  lines:
    'Paste into a Text action, then Split Text (Separator: New Lines) → Choose from List.',
  comma:
    'Paste into a Text action, then Split Text with a custom separator of ", ". Also the exact format the tags= parameter takes.',
  json:
    'Paste into a Text action, then Get Dictionary from Input → Get Dictionary Value with Chosen Item as the key. Gives you the id, for category_id= / account_id=.',
};

function formatList(items: NamedItem[], format: ListFormat): string {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (format === "json") {
    return JSON.stringify(
      Object.fromEntries(sorted.map((item) => [item.name, item.id])),
      null,
      2,
    );
  }
  return sorted.map((item) => item.name).join(format === "comma" ? ", " : "\n");
}

function DataListBlock({
  title,
  usage,
  items,
  format,
}: {
  title: string;
  usage: string;
  items: NamedItem[];
  format: ListFormat;
}) {
  const value = formatList(items, format);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {title}{" "}
            <span className="text-muted-foreground font-normal">
              ({items.length})
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{usage}</p>
        </div>
        {items.length > 0 && <CopyButton value={value} label="Copy" />}
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        <pre className="max-h-44 overflow-auto rounded-md bg-muted px-3 py-2 text-xs whitespace-pre-wrap break-words">
          {value}
        </pre>
      )}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {
      const el = document.createElement("textarea");
      el.value = value;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 shrink-0">
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function UrlBlock({ url, label = "Copy" }: { url: string; label?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="flex-1 min-w-0 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs whitespace-pre">
        {url}
      </code>
      <CopyButton value={url} label={label} />
    </div>
  );
}

export function QuickAddSettingsSection() {
  const { data: accounts } = useAccounts({ active: true, exclude_debts: true });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [listFormat, setListFormat] = useState<ListFormat>("lines");

  // Every URL on this page is built from VITE_APP_HOST (or, unset, from the
  // address you are reading this at), so the examples are always right for
  // this install — and the toggle swaps them between browser and installed app.
  const [scheme, setScheme] = useState<LinkScheme>("web");
  const host = useMemo(() => appHost(), []);
  const link = (path: string) => appLink(path, scheme);

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === "expense"),
    [categories],
  );
  const incomeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === "income"),
    [categories],
  );
  const hasCommaInName = useMemo(
    () =>
      [...(accounts ?? []), ...(categories ?? []), ...(tags ?? [])].some((item) =>
        item.name.includes(","),
      ),
    [accounts, categories, tags],
  );

  const sampleAccount = accounts?.[0]?.name ?? "YourBank";
  const sampleCategory =
    categories?.find((c) => c.type === "expense")?.name ?? "YourCategory";

  const encode = (value: string) => encodeURIComponent(value);
  const prefillUrl = link(
    `/transactions/new?amount=222&description=storeName&date=02/05/2026&category=${encode(sampleCategory)}`,
  );
  const submitUrl = link(
    `/transactions/new?amount=4.20&description=Coffee&category=${encode(sampleCategory)}&account=${encode(sampleAccount)}&submit=1`,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Quick add links
          </CardTitle>
          <CardDescription>
            Open the transaction form with fields already filled, from anything
            that can open a URL — iOS Shortcuts, a home screen bookmark, an NFC
            tag, a QR code, a widget or a terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={scheme === "web" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheme("web")}
              className="gap-2"
            >
              <Globe className="size-4" />
              Browser
            </Button>
            <Button
              variant={scheme === "webapp" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheme("webapp")}
              className="gap-2"
            >
              <Smartphone className="size-4" />
              Installed app
            </Button>
            <span className="text-xs text-muted-foreground">
              swaps every link below between{" "}
              <code className="text-xs">https://</code> and{" "}
              <code className="text-xs">webapp://</code>
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Opens the form, prefilled</p>
            <UrlBlock url={prefillUrl} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Saves without showing the form
            </p>
            <UrlBlock url={submitUrl} />
          </div>
          <p className="text-sm text-muted-foreground">
            <code className="text-xs">/transactions/new</code> and{" "}
            <code className="text-xs">/transactions/create</code> are the same
            page — <code className="text-xs">new</code> is just shorter to type
            into an automation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4" />
            Which URL do I use?
          </CardTitle>
          <CardDescription>
            Same app, same spreadsheet — the scheme decides which window opens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y text-sm">
            <div className="space-y-1 py-3 first:pt-0">
              <p className="font-medium">Installed on the home screen</p>
              <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-xs whitespace-pre">
                webapp://{host}/transactions/new?…
              </code>
              <p className="text-muted-foreground">
                Opens the installed app directly. Use this one in iOS Shortcuts
                once the app is on your home screen — an https link would hand
                the shortcut to Safari instead.
              </p>
            </div>
            <div className="space-y-1 py-3">
              <p className="font-medium">On the web</p>
              <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-xs whitespace-pre">
                https://{host}/transactions/new?…
              </code>
              <p className="text-muted-foreground">
                Opens in the browser. Works on any platform, installed or not —
                use it wherever the app might not be installed.
              </p>
            </div>
            <div className="space-y-1 py-3 last:pb-0">
              <p className="font-medium">Local development</p>
              <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-xs whitespace-pre">
                http://localhost:5178/xpp/transactions/new?…
              </code>
              <p className="text-muted-foreground">
                With no host configured, this page falls back to the address it
                is served from, so the examples above already point at your dev
                server.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The host — <code className="text-xs">{host}</code> — comes from{" "}
            <code className="text-xs">VITE_APP_HOST</code> in{" "}
            <code className="text-xs">.env.production</code>. Change it there
            once and every link in the app, in both schemes, follows.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Every parameter</CardTitle>
          <CardDescription>
            All optional. Anything that cannot be resolved opens the form with a
            warning instead of saving something wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {PARAMS.map((param) => (
            <div key={param.name} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-medium">
                  {param.name}
                </code>
                {param.aliases?.map((alias) => (
                  <Badge key={alias} variant="secondary" className="font-mono text-[11px]">
                    {alias}
                  </Badge>
                ))}
                {param.required && (
                  <Badge variant="outline" className="text-[11px]">
                    required for {param.required}
                  </Badge>
                )}
              </div>
              <p className="text-sm">{param.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {param.accepts.map((value) => (
                  <code
                    key={value}
                    className="rounded bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {param.name}={value}
                  </code>
                ))}
              </div>
              {param.note && (
                <p className="text-xs text-muted-foreground">{param.note}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How names are matched</CardTitle>
          <CardDescription>
            Automations cannot know internal ids, so accounts, categories and
            tags are addressable by name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Case, accents, spaces and punctuation are ignored —{" "}
            <code className="text-xs">food</code>,{" "}
            <code className="text-xs">Food</code> and{" "}
            <code className="text-xs">food-and-drinks</code> all find "Food &
            Drinks". Matching tries an exact id, then an exact name, then a
            unique prefix, then a unique substring.
          </p>
          <p className="text-muted-foreground">
            A value that matches two entries is reported, never guessed: with
            both a "Cash Wallet" and a "Cash Savings",{" "}
            <code className="text-xs">account=cash</code> saves nothing and asks
            you to be specific. Ids still work everywhere names do, and survive
            renaming — you can read one from an account's edit URL.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4" />
            Your lists, ready to paste
          </CardTitle>
          <CardDescription>
            Shortcuts has no way to read your categories — copy them here and
            paste them into a Choose from List, so the picker always offers real
            names that resolve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["lines", "One per line"],
                  ["comma", "Comma-separated"],
                  ["json", "Name → id"],
                ] as [ListFormat, string][]
              ).map(([value, label]) => (
                <Button
                  key={value}
                  variant={listFormat === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setListFormat(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {LIST_FORMAT_HINTS[listFormat]}
            </p>
          </div>

          <DataListBlock
            title="Accounts"
            usage="For the account= picker"
            items={accounts ?? []}
            format={listFormat}
          />
          <DataListBlock
            title="Expense categories"
            usage="For the category= picker on spending"
            items={expenseCategories}
            format={listFormat}
          />
          <DataListBlock
            title="Income categories"
            usage="For the category= picker on income"
            items={incomeCategories}
            format={listFormat}
          />
          <DataListBlock
            title="Tags"
            usage="For tags= — comma-separated is the format the parameter itself takes"
            items={tags ?? []}
            format={listFormat}
          />

          {listFormat === "comma" && hasCommaInName && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              One of your names contains a comma, which Split Text would break
              apart. Use one-per-line for that list.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Names are what you paste into a URL; the name → id format is for
            when you would rather send ids that survive a rename — feed the
            dictionary a chosen name and put the result in{" "}
            <code className="text-xs">category_id=</code> or{" "}
            <code className="text-xs">account_id=</code>. Re-copy after adding a
            category, and the Shortcut picks it up.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Building an iOS Shortcut</CardTitle>
          <CardDescription>
            One shortcut can cover every card you pay with.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <span className="font-medium">List</span> — one line per account,
              spelled as in the app.
            </li>
            <li>
              <span className="font-medium">Choose from List</span> ("Which
              bank?") — gives you <em>Chosen Item</em>. Prefer this over Choose
              from Menu, which forces you to rebuild the URL in every branch.
            </li>
            <li>
              <span className="font-medium">Ask for Input</span> (Number) for
              the amount.
            </li>
            <li>
              <span className="font-medium">Text</span> — the URL, with the
              variables dropped into <code className="text-xs">amount=</code>{" "}
              and <code className="text-xs">account=</code>.
            </li>
            <li>
              <span className="font-medium">URL Encode</span>, then{" "}
              <span className="font-medium">Open URLs</span>.
            </li>
          </ol>
          <UrlBlock
            url={link(
              `/transactions/new?amount=[Provided Input]&account=[Chosen Item]&category=${encode(sampleCategory)}&submit=1`,
            )}
            label="Copy template"
          />
          <p className="text-muted-foreground">
            With the app on your home screen, keep the toggle on{" "}
            <span className="font-medium">Installed app</span> so the shortcut
            opens Finix rather than Safari.
          </p>
          <p className="text-muted-foreground">
            Drop <code className="text-xs">submit=1</code> to confirm on screen
            instead — the form opens with the bank already selected. Add a
            second Choose from List for the category to make it universal, or a
            Format Date action (<code className="text-xs">yyyy-MM-dd</code>) to
            stamp a specific day.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
