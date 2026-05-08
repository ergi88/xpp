// src/auth/setup/steps/ConnectStep.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  Loader2,
  ExternalLink,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { STORAGE_KEYS } from "@/lib/auth";
import { adapter } from "@/lib/sheets";
import { settingsApi } from "@/api";
import { currenciesApi } from "@/api/currencies";

const GAS_SCRIPT = `// Replace with your actual spreadsheet ID
var SPREADSHEET_ID = '';

function doGet(e) {
  try {
    var resource = e.parameter.resource;
    var action = e.parameter.action;
    var result;
    if (action === 'getAll') {
      result = getAllRows(resource);
    } else if (action === 'getById') {
      result = getRowById(resource, e.parameter.id);
    } else {
      throw new Error('Unknown action: ' + action);
    }
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err.message);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var resource = body.resource;
    var result;
    if (action === 'create') {
      result = createRow(resource, body.data);
    } else if (action === 'update') {
      result = updateRow(resource, body.id, body.data);
    } else if (action === 'delete') {
      deleteRow(resource, body.id);
      result = { success: true };
    } else {
      throw new Error('Unknown action: ' + action);
    }
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err.message);
  }
}

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getAllRows(resource) {
  var sheet = getSheet(resource);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) { return rowToObj(headers, row); });
}

function getRowById(resource, id) {
  var sheet = getSheet(resource);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  var headers = data[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      return rowToObj(headers, data[i]);
    }
  }
  return null;
}

function createRow(resource, data) {
  var sheet = getSheet(resource);
  var existing = sheet.getDataRange().getValues();
  var headers;
  if (existing.length === 0 || (existing.length === 1 && existing[0].every(function(c){ return c === ''; }))) {
    headers = Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers = existing[0];
  }
  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  sheet.appendRow(row);
  return data;
}

function updateRow(resource, id, data) {
  var sheet = getSheet(resource);
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      headers.forEach(function(h, j) {
        if (data[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data[h]);
        }
      });
      var updated = rowToObj(headers, sheet.getRange(i + 1, 1, 1, headers.length).getValues()[0]);
      return updated;
    }
  }
  throw new Error('Row not found: ' + id);
}

function deleteRow(resource, id) {
  var sheet = getSheet(resource);
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error('Row not found: ' + id);
}

function rowToObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const schema = z.object({
  gasUrl: z
    .string()
    .url("Must be a valid URL")
    .refine((v) => v.includes("script.google.com"), {
      message: "Must be a Google Apps Script URL",
    }),
  spreadsheetId: z.string().min(10, "Spreadsheet ID is required"),
});
type FormData = z.infer<typeof schema>;

interface ConnectStepProps {
  onNext: (hasExistingData?: boolean) => void;
}

export function ConnectStep({ onNext }: ConnectStepProps) {
  const [testState, setTestState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState("");
  const [hasExistingAccounts, setHasExistingAccounts] = useState(false);
  const [baseCurrencyCode, setBaseCurrencyCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);

  const {
    register,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(GAS_SCRIPT).catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = () => {
    const el = document.createElement("textarea");
    el.value = GAS_SCRIPT;
    el.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  };

  const handleValidate = async () => {
    const { gasUrl, spreadsheetId } = getValues();
    if (!gasUrl || !spreadsheetId) return;
    setTestState("loading");
    setTestError("");
    setHasExistingAccounts(false);
    setBaseCurrencyCode(null);

    try {
      localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl);
      localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId);

      const [accountRows, currencies] = await Promise.all([
        adapter.getAll("accounts"),
        currenciesApi.getAll(),
        settingsApi.syncFromSheet(),
      ]);

      const base = currencies.find((c) => c.isBase);
      if (base) setBaseCurrencyCode(base.code);

      if (accountRows.length > 0) {
        setHasExistingAccounts(true);
      }

      setTestState("success");
    } catch (err) {
      localStorage.removeItem(STORAGE_KEYS.GAS_URL);
      localStorage.removeItem(STORAGE_KEYS.SPREADSHEET_ID);
      setTestState("error");
      setTestError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Setup guide
            {guideOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="mt-3 flex flex-col gap-5 text-sm">
            <li className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                1
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">Create a Google Sheet</p>
                <p className="text-muted-foreground">
                  Go to{" "}
                  <a
                    href="https://sheets.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-0.5"
                  >
                    sheets.google.com <ExternalLink className="size-3" />
                  </a>{" "}
                  and create a blank spreadsheet. Change file access to{" "}
                  <strong>Anyone with the link</strong> with permissions set to{" "}
                  <strong>Editor</strong>. Copy its ID from the URL:
                </p>
                <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  docs.google.com/spreadsheets/d/
                  <span className="font-semibold text-foreground">
                    YOUR_ID_HERE
                  </span>
                  /edit
                </code>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                2
              </span>
              <div className="flex flex-col gap-1 w-full min-w-0">
                <p className="font-medium">Add the backend script</p>
                <p className="text-muted-foreground">
                  Open{" "}
                  <a
                    href="https://script.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-0.5"
                  >
                    script.google.com <ExternalLink className="size-3" />
                  </a>{" "}
                  → New project → replace everything in{" "}
                  <code className="rounded bg-muted px-1">Code.gs</code> with
                  the script below.
                </p>
                <div className="relative mt-1">
                  <pre className="max-h-32 overflow-hidden rounded border bg-muted px-3 py-2 text-xs text-muted-foreground leading-relaxed select-none">
                    {GAS_SCRIPT.slice(0, 260)}
                    {"…"}
                  </pre>
                  <div className="absolute inset-0 flex items-end justify-end rounded p-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1.5 text-xs shadow-sm z-10"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="size-3" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copied ? "Copied!" : "Copy full script"}
                    </Button>
                  </div>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                3
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  Set your spreadsheet ID in the script
                </p>
                <p className="text-muted-foreground">
                  On line 2 of{" "}
                  <code className="rounded bg-muted px-1">Code.gs</code>, paste
                  your sheet ID:
                </p>
                <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">
                  var SPREADSHEET_ID ={" "}
                  <span className="text-foreground font-semibold">
                    'your-id-here'
                  </span>
                  ;
                </code>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                4
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">Deploy as a web app</p>
                <p className="text-muted-foreground">
                  Click <strong>Deploy</strong> →{" "}
                  <strong>New deployment</strong> → type:{" "}
                  <strong>Web app</strong>, then configure:
                </p>
                <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                  <li>
                    · Execute as: <strong>Me</strong>
                  </li>
                  <li>
                    · Who has access:{" "}
                    <strong className="text-foreground">Anyone</strong>{" "}
                    <span className="text-xs">
                      — required, the app calls this URL without a login
                    </span>
                  </li>
                </ul>
                <p className="text-muted-foreground mt-1">
                  Click <strong>Deploy</strong> → authorize when prompted → copy
                  the deployment URL.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                5
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">Paste below and validate</p>
                <p className="text-muted-foreground">
                  Enter the deployment URL and spreadsheet ID in the fields
                  below, then click <strong>Validate</strong>.
                </p>
              </div>
            </li>
          </ol>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gasUrl">Google Apps Script URL</Label>
        <Input
          id="gasUrl"
          placeholder="https://script.google.com/macros/s/.../exec"
          {...register("gasUrl")}
        />
        {errors.gasUrl && (
          <p className="text-xs text-destructive">{errors.gasUrl.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
        <Input
          id="spreadsheetId"
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          {...register("spreadsheetId")}
        />
        {errors.spreadsheetId && (
          <p className="text-xs text-destructive">
            {errors.spreadsheetId.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          From the sheet URL: docs.google.com/spreadsheets/d/
          <span className="font-mono font-semibold text-orange-400">ID</span>
          /edit
        </p>
      </div>

      {testState === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{testError}</AlertDescription>
        </Alert>
      )}

      {testState === "success" && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            Connected successfully
            {baseCurrencyCode && ` · Base currency: ${baseCurrencyCode}`}
          </AlertDescription>
        </Alert>
      )}

      {hasExistingAccounts && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Existing accounts found — currency and account setup will be
            skipped.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleValidate}
          disabled={testState === "loading"}
        >
          {testState === "loading" && (
            <Loader2 className="size-4 mr-2 animate-spin" />
          )}
          Validate
        </Button>
        <Button
          type="button"
          onClick={() => onNext(hasExistingAccounts)}
          disabled={testState !== "success"}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
