import { Link } from "react-router-dom";
import { LayoutTemplate, Plus } from "lucide-react";
import { useTemplates } from "@/hooks";
import { cn } from "@/lib/utils";
import type { TransactionTemplate } from "@/types";

type TxType = TransactionTemplate["type"];

interface TemplateShortcutsProps {
  type: TxType;
  onPick: (template: TransactionTemplate) => void;
}

/**
 * Horizontal row of one-tap template chips shown on the transaction form.
 * Only templates matching the currently selected type are shown, so the row
 * reacts to the type tabs above it. A trailing "New" chip keeps the feature
 * discoverable even when there are no templates yet.
 */
export function TemplateShortcuts({ type, onPick }: TemplateShortcutsProps) {
  const { data: templates } = useTemplates();

  const matching = (templates ?? []).filter((t) => t.type === type);

  return (
    <div className="-mx-2 flex items-center gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <LayoutTemplate className="size-3.5 shrink-0 text-muted-foreground" />
      {matching.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium",
            "backdrop-blur-xl transition hover:border-muted-foreground/40 hover:bg-accent/40",
          )}
        >
          {t.icon && <span className="text-sm leading-none">{t.icon}</span>}
          <span className="max-w-[10rem] truncate">{t.name}</span>
          {t.amount != null && (
            <span className="tabular-nums text-muted-foreground">
              {t.amount}
            </span>
          )}
        </button>
      ))}
      <Link
        to="/templates/create"
        className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <Plus className="size-3" />
        {matching.length === 0 ? "New template" : "New"}
      </Link>
    </div>
  );
}
