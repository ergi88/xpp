import { LayoutGrid, Tag as TagIcon, Wallet } from "lucide-react";
import type { TokenKind } from "./lib/transactionParser";

export interface Suggestion {
  id: string;
  name: string;
}

interface Props {
  kind: TokenKind;
  suggestions: Suggestion[];
  onPick: (name: string) => void;
}

const KIND_META: Record<TokenKind, { label: string; icon: typeof Wallet }> = {
  category: { label: "Category", icon: LayoutGrid },
  tag: { label: "Tag", icon: TagIcon },
  account: { label: "Account", icon: Wallet },
};

/**
 * Horizontal suggestion strip shown above the footer while typing inside a `//`
 * comment. Tapping a chip splices the name into the editor at the caret.
 */
export function TokenAutocomplete({ kind, suggestions, onPick }: Props) {
  if (suggestions.length === 0) return null;
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-1.5 border-t border-white/5 bg-black/20 px-3 py-2 overflow-x-auto">
      <span className="flex shrink-0 items-center gap-1 pr-1 text-[9px] font-semibold tracking-[0.15em] text-white/40">
        <Icon className="size-3" />
        {meta.label.toUpperCase()}
      </span>
      {suggestions.map((s) => (
        <button
          key={s.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s.name)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/15"
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
