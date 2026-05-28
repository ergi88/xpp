import { useState } from "react";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  description?: string;
  isPending?: boolean;
  onConfirm: (opts: { skipEffects: boolean }) => void;
}

// Reusable confirmation body for transaction delete. Drop inside an
// <AlertDialog> alongside the trigger. The skip-effects checkbox lets the
// user delete a TX whose balance side-effect already failed, without
// double-corrupting the account/debt totals.
export function DeleteTransactionAlertContent({
  description = "This will reverse the account balance and any linked debt effects. This cannot be undone.",
  isPending,
  onConfirm,
}: Props) {
  const [skipEffects, setSkipEffects] = useState(false);

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <label className="flex items-start gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-left">
        <Checkbox
          checked={skipEffects}
          onCheckedChange={(v) => setSkipEffects(v === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Skip balance update</div>
          <div className="text-[11px] leading-snug text-muted-foreground">
            Use this when the account/debt balance was never updated for this
            transaction. Deletes the row only, without reversing balances.
          </div>
        </div>
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => onConfirm({ skipEffects })}
          disabled={isPending}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isPending ? "Deleting…" : "Delete"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
