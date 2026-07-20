import { useRef } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";

import { FormPage } from "@/components/shared";
import { useAccounts, useCategories, useTags } from "@/hooks";
import { TransactionReview } from "@/components/features/mini-apps/calci-pad/TransactionReview";
import { STORAGE_PREFIX } from "@/components/features/mini-apps/calci-pad";
import { buildDrafts, markLine } from "@/components/features/mini-apps/calci-pad/lib/transactionParser";
import { loadPages, savePages } from "@/components/features/mini-apps/calci-pad/lib/persistence";
import type { ParsedDraft } from "@/components/features/mini-apps/calci-pad/types";

interface BulkState {
  calciText?: string;
  calciPageId?: string;
}

export default function TransactionBulkCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as BulkState;
  const text = state.calciText ?? "";
  const pageId = state.calciPageId;

  const { data: accounts } = useAccounts({ active: true, exclude_debts: true });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();

  // Build drafts exactly once, when all lookups are first available. Rebuilding
  // would mint new row ids and wipe the user's in-progress edits.
  const draftsRef = useRef<ParsedDraft[] | null>(null);
  if (draftsRef.current === null && accounts && categories && tags) {
    draftsRef.current = buildDrafts(text, {
      accounts,
      categories,
      tags,
      currencies: [],
    });
  }
  const drafts = draftsRef.current;

  // Opened directly (no hand-off from CalciPad) → nothing to do.
  if (!text) return <Navigate to="/transactions" replace />;

  // Mark the saved lines in the CalciPad page (localStorage) with the created
  // glyph instead of deleting them, so they show as done and can be re-added.
  const markSavedLines = (savedLineIndices: number[]) => {
    if (!pageId || savedLineIndices.length === 0) return;
    const mark = new Set(savedLineIndices);
    const pages = loadPages(STORAGE_PREFIX);
    const next = pages.map((p) =>
      p.id === pageId
        ? {
            ...p,
            content: p.content
              .split("\n")
              .map((line, i) => (mark.has(i) ? markLine(line) : line))
              .join("\n"),
            lastModified: new Date().toISOString(),
          }
        : p,
    );
    savePages(next, STORAGE_PREFIX);
  };

  return (
    <FormPage
      title="Review Transactions"
      backLink="/transactions"
      isLoading={!drafts}
    >
      {drafts && (
        <TransactionReview
          drafts={drafts}
          onSaved={markSavedLines}
          onDone={() => navigate("/transactions")}
        />
      )}
    </FormPage>
  );
}
