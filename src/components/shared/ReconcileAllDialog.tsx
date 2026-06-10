import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wallet,
  HandCoins,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AmountText } from "@/components/shared/AmountText";
import { useApplyReconcile, useReconcileReport } from "@/hooks";
import type { ReconcileDriftEntry, ReconcileReport } from "@/api";
import { cn } from "@/lib/utils";

const entryKey = (e: ReconcileDriftEntry) => `${e.kind}-${e.id}`;
const entryHref = (e: ReconcileDriftEntry) =>
  e.kind === "account" ? `/accounts/${e.id}` : `/debts/${e.id}`;

interface ReconcileAllDialogProps {
  /** Controlled open state. When provided, the built-in trigger is hidden. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReconcileAllDialog({
  open: openProp,
  onOpenChange,
}: ReconcileAllDialogProps = {}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const computeMutation = useReconcileReport();
  const applyMutation = useApplyReconcile();

  const handleOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
    if (!next) {
      setReport(null);
      setSelected(new Set());
      computeMutation.reset();
      applyMutation.reset();
    } else {
      computeMutation.mutate(undefined, {
        onSuccess: (r) => {
          setReport(r);
          setSelected(new Set(r.entries.map(entryKey)));
        },
      });
    }
  };

  // When opened via the controlled prop (e.g. from the header dropdown), the
  // built-in trigger never runs, so kick off the scan here.
  useEffect(() => {
    if (isControlled && open && !report && !computeMutation.isPending) {
      computeMutation.mutate(undefined, {
        onSuccess: (r) => {
          setReport(r);
          setSelected(new Set(r.entries.map(entryKey)));
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, open]);

  const entries = report?.entries ?? [];
  const hasDrift = entries.length > 0;
  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(entryKey(e))),
    [entries, selected],
  );

  const allSelected = hasDrift && selectedEntries.length === entries.length;
  const someSelected = selectedEntries.length > 0 && !allSelected;

  // Keep header checkbox in sync (Radix Checkbox needs a string for indeterminate)
  const headerChecked: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  const toggleEntry = (e: ReconcileDriftEntry) => {
    const k = entryKey(e);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === entries.length ? new Set() : new Set(entries.map(entryKey)),
    );
  };

  const handleApply = () => {
    if (!report || selectedEntries.length === 0) return;
    const subset: ReconcileReport = { ...report, entries: selectedEntries };
    applyMutation.mutate(subset, {
      onSuccess: () => {
        setReport(null);
        setSelected(new Set());
        handleOpen(false);
      },
    });
  };

  // Keep selection in bounds if the report ever changes underneath us
  useEffect(() => {
    if (!report) return;
    const valid = new Set(report.entries.map(entryKey));
    setSelected((prev) => {
      const next = new Set<string>();
      for (const k of prev) if (valid.has(k)) next.add(k);
      return next.size === prev.size ? prev : next;
    });
  }, [report]);

  const isComputing = computeMutation.isPending;
  const isApplying = applyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!isControlled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpen(true)}
          className="gap-2"
        >
          <RefreshCw className="size-4" />
          Reconcile
        </Button>
      )}

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reconcile all balances</DialogTitle>
          <DialogDescription>
            Recomputes every account balance and debt running total from the
            transactions sheet. Pick which entries to fix — click a name to
            inspect it first.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-32">
          {isComputing && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              Scanning transactions…
            </div>
          )}

          {!isComputing && report && !hasDrift && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <div className="text-sm font-semibold">All balances match</div>
              <div className="text-xs text-muted-foreground">
                Checked {report.checkedAccounts} account
                {report.checkedAccounts === 1 ? "" : "s"} and{" "}
                {report.checkedDebts} debt
                {report.checkedDebts === 1 ? "" : "s"}.
              </div>
            </div>
          )}

          {!isComputing && report && hasDrift && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  Found drift on {entries.length}{" "}
                  {entries.length === 1 ? "entry" : "entries"}. Review and
                  uncheck anything you want to leave alone.
                </span>
              </div>

              <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={headerChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Select all drifted entries"
                />
                <span>
                  {selectedEntries.length} of {entries.length} selected
                </span>
              </label>

              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {entries.map((entry) => {
                  const Icon = entry.kind === "account" ? Wallet : HandCoins;
                  const positive = entry.drift > 0;
                  const k = entryKey(entry);
                  const checked = selected.has(k);
                  return (
                    <div
                      key={k}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition",
                        checked
                          ? "border-border bg-card/40"
                          : "border-border/40 bg-card/20 opacity-60",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleEntry(entry)}
                          aria-label={`Fix ${entry.name}`}
                        />
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={entryHref(entry)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex min-w-0 items-center gap-1.5 text-sm font-semibold hover:text-primary"
                          >
                            <span className="truncate">{entry.name}</span>
                            <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
                          </Link>
                          <div className="text-[11px] capitalize text-muted-foreground">
                            {entry.kind}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums">
                        <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                          <AmountText
                            value={entry.currentBalance}
                            decimals={entry.decimals}
                            currency={entry.currencySymbol}
                          />
                          <span>→</span>
                          <span className="font-semibold text-foreground">
                            <AmountText
                              value={entry.expectedBalance}
                              decimals={entry.decimals}
                              currency={entry.currencySymbol}
                            />
                          </span>
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-[11px] font-medium",
                            positive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {positive ? "+" : ""}
                          <AmountText
                            value={entry.drift}
                            decimals={entry.decimals}
                            currency={entry.currencySymbol}
                            hideable={false}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpen(false)}
            disabled={isApplying}
          >
            {hasDrift ? "Cancel" : "Close"}
          </Button>
          {hasDrift && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={
                isApplying || isComputing || selectedEntries.length === 0
              }
            >
              {isApplying
                ? "Applying…"
                : selectedEntries.length === 0
                  ? "Pick at least one"
                  : `Fix ${selectedEntries.length}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
