import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BellOff,
  CheckCheck,
  ExternalLink,
  RefreshCw,
  RotateCw,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { Page } from "@/components/shared/Page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks";
import {
  useApplyReconcile,
  useReconcileReport,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/hooks";
import type { AppNotification, NotificationKind } from "@/lib/notifications";
import type { TransactionFormValues } from "@/schemas";
import { toast } from "sonner";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const KIND_META: Record<NotificationKind, { label: string }> = {
  tx_create_failed: { label: "Create failed" },
  tx_update_failed: { label: "Update failed" },
  tx_delete_failed: { label: "Delete failed" },
  balance_effect_failed: { label: "Balance drift" },
};

export default function NotificationsPage() {
  const {
    items,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
  } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const visible = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [items, filter],
  );

  return (
    <Page title="Notifications">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded px-2.5 py-1 transition",
                filter === "all"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded px-2.5 py-1 transition",
                filter === "unread"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Unread
            </button>
          </div>
          {items.length > 0 && (
            <>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAllRead()}
                  className="gap-1.5"
                >
                  <CheckCheck className="size-4" />
                  Mark all read
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes every notification, read and unread. The
                      underlying transactions are not touched.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearAll()}>
                      Clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 py-16 text-center">
          <BellOff className="size-8 text-muted-foreground" />
          <div className="text-sm font-semibold">No notifications</div>
          <div className="text-xs text-muted-foreground">
            Transaction errors and balance issues will show up here.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onMarkRead={() => markRead(n.id)}
              onDismiss={() => dismiss(n.id)}
            />
          ))}
        </div>
      )}
    </Page>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
  onDismiss,
}: {
  notification: AppNotification;
  onMarkRead: () => void;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();
  const computeReport = useReconcileReport();
  const applyReconcile = useApplyReconcile();

  const { kind, context, title, message, createdAt, read } = notification;
  const meta = KIND_META[kind];

  const handleRetry = () => {
    if (kind === "tx_create_failed" && context.txPayload) {
      createTx.mutate(context.txPayload as TransactionFormValues, {
        onSuccess: () => {
          toast.success("Retried — transaction created");
          onDismiss();
        },
      });
      return;
    }
    if (kind === "tx_update_failed" && context.txId && context.txPayload) {
      updateTx.mutate(
        { id: context.txId, data: context.txPayload },
        {
          onSuccess: () => {
            toast.success("Retried — transaction updated");
            onDismiss();
          },
        },
      );
      return;
    }
    if (kind === "tx_delete_failed" && context.txId) {
      deleteTx.mutate(context.txId, {
        onSuccess: () => {
          toast.success("Retried — transaction deleted");
          onDismiss();
        },
      });
      return;
    }
  };

  const handleRecalculate = () => {
    if (!context.accountId && !context.toAccountId && !context.debtId) return;
    computeReport.mutate(undefined, {
      onSuccess: (report) => {
        const affectedIds = [
          context.accountId,
          context.toAccountId,
          context.debtId,
        ].filter(Boolean) as string[];
        const subset = {
          ...report,
          entries: report.entries.filter((e) => affectedIds.includes(e.id)),
        };
        if (subset.entries.length === 0) {
          toast.success("No drift detected on affected accounts");
          onDismiss();
          return;
        }
        applyReconcile.mutate(subset, {
          onSuccess: () => {
            onDismiss();
          },
        });
      },
    });
  };

  const handleOpenTx = () => {
    if (context.txId) navigate(`/transactions/${context.txId}`);
  };

  const handleDeleteTx = () => {
    if (!context.txId) return;
    deleteTx.mutate(context.txId, {
      onSuccess: () => {
        toast.success("Transaction deleted");
        onDismiss();
      },
    });
  };

  const actions: { label: string; onClick: () => void; icon: typeof RotateCw }[] = [];
  if (kind === "tx_create_failed" && context.txPayload) {
    actions.push({ label: "Retry create", onClick: handleRetry, icon: RotateCw });
  }
  if (kind === "tx_update_failed" && context.txId) {
    actions.push({ label: "Retry update", onClick: handleRetry, icon: RotateCw });
    actions.push({ label: "Open transaction", onClick: handleOpenTx, icon: ExternalLink });
  }
  if (kind === "tx_delete_failed" && context.txId) {
    actions.push({ label: "Retry delete", onClick: handleRetry, icon: RotateCw });
    actions.push({ label: "Open transaction", onClick: handleOpenTx, icon: ExternalLink });
  }
  if (kind === "balance_effect_failed") {
    if (context.accountId || context.toAccountId || context.debtId) {
      actions.push({
        label: "Recalculate affected",
        onClick: handleRecalculate,
        icon: RefreshCw,
      });
    }
    if (context.txId) {
      actions.push({ label: "Open transaction", onClick: handleOpenTx, icon: ExternalLink });
      actions.push({ label: "Delete transaction", onClick: handleDeleteTx, icon: Trash2 });
    }
  }

  const pending =
    createTx.isPending ||
    updateTx.isPending ||
    deleteTx.isPending ||
    computeReport.isPending ||
    applyReconcile.isPending;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/40 p-3 transition",
        read ? "border-border/40 opacity-70" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/10">
          {kind === "balance_effect_failed" ? (
            <Wallet className="size-4 text-destructive" />
          ) : (
            <AlertCircle className="size-4 text-destructive" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{title}</div>
            {!read && (
              <span className="size-2 shrink-0 rounded-full bg-primary" />
            )}
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {relativeTime(createdAt)}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{message}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-1.5 py-0.5">
              {meta.label}
            </span>
            {context.accountId && (
              <Link
                to={`/accounts/${context.accountId}`}
                className="rounded-full border border-border bg-background px-1.5 py-0.5 hover:text-foreground"
              >
                account
              </Link>
            )}
            {context.debtId && (
              <Link
                to={`/debts/${context.debtId}`}
                className="rounded-full border border-border bg-background px-1.5 py-0.5 hover:text-foreground"
              >
                debt
              </Link>
            )}
            {context.txId && (
              <Link
                to={`/transactions/${context.txId}`}
                className="rounded-full border border-border bg-background px-1.5 py-0.5 hover:text-foreground"
              >
                tx
              </Link>
            )}
          </div>
          {actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <Button
                    key={a.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={a.onClick}
                    disabled={pending}
                  >
                    <Icon className="size-3.5" />
                    {a.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="More"
            >
              <X className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!read && (
              <DropdownMenuItem onClick={onMarkRead}>
                Mark as read
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDismiss}>Dismiss</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
