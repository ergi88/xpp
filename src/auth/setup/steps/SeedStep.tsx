// src/auth/setup/steps/SeedStep.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, SkipForward } from "lucide-react";
import { categoriesApi, currenciesApi, tagsApi } from "@/api";
import { seedPresets } from "@/components/features/import/bulk-seed-presets";

const ALL_ITEMS = seedPresets.find((p) => p.id === "database")!.items;

interface SeedStepProps {
  onNext: () => void;
}

export function SeedStep({ onNext }: SeedStepProps) {
  const [done, setDone] = useState(0);
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        for (const item of ALL_ITEMS) {
          if (cancelled) return;
          if (item.kind === "currency") await currenciesApi.create(item.data);
          else if (item.kind === "category")
            await categoriesApi.create(item.data);
          else await tagsApi.create(item.data);
          if (!cancelled) setDone((d) => d + 1);
        }
        if (!cancelled) setState("success");
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : "Seeding failed");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const percent = Math.round((done / ALL_ITEMS.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Seeding default currencies, categories, and tags into your sheet.
          This runs once and takes a moment.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {done} / {ALL_ITEMS.length} items
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {state === "loading" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Loader2 className="size-3 animate-spin" />
            {done < ALL_ITEMS.length
              ? `Seeding ${ALL_ITEMS[done]?.kind ?? ""}…`
              : "Finishing up…"}
          </p>
        )}
      </div>

      {state === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {state === "success" && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            Seeded {ALL_ITEMS.length} defaults — currencies, categories, and
            tags are ready.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button onClick={onNext} disabled={state === "loading"}>
          {state === "loading" && (
            <Loader2 className="size-4 mr-2 animate-spin" />
          )}
          Continue
        </Button>
        {state === "loading" && (
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={onNext}
          >
            <SkipForward className="size-4" />
            Skip seeding
          </Button>
        )}
      </div>
    </div>
  );
}
