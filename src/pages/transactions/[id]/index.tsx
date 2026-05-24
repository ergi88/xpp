/* Hallmark · redesign: transaction-detail · tone: utilitarian · genre: modern-minimal
 * pre-emit critique: P4 H5 E4 S5 R4 V4
 * changes: CategoryPill for category + split children, divide-y details with icons,
 *   colored type stripe on hero, action hierarchy (primary / workflow / toggles / delete isolated)
 */
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useFABActions } from "@/lib/fab-context";
import { Page, StickyFooterActions } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AmountText } from "@/components/shared/AmountText";
import { CategoryPill } from "@/components/shared/CategoryPill";
import {
  useTransaction,
  useDeleteTransaction,
  useDuplicateTransaction,
  useToggleTransactionFlag,
  useSplitTransaction,
  useUnsplitTransaction,
  useLinkCounterpart,
  useUnlinkCounterpart,
} from "@/hooks";
import {
  Pencil,
  Copy,
  Trash2,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Ban,
  Star,
  Split,
  Link2,
  Link2Off,
  Repeat,
  CheckCircle2,
  CalendarDays,
  Clock,
  Wallet,
  Tag,
  ExternalLink,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SplitEditor,
  PendingDebtForRow,
} from "@/components/features/transactions/SplitEditor";
import { debtsApi } from "@/api/debts";
import { CounterpartLinkPicker } from "@/components/features/transactions/CounterpartLinkPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_CONFIG = {
  income: {
    icon: ArrowDownLeft,
    color: "text-green-600",
    label: "Income",
    stripe: "bg-green-500",
  },
  expense: {
    icon: ArrowUpRight,
    color: "text-red-600",
    label: "Expense",
    stripe: "bg-red-500",
  },
  transfer: {
    icon: ArrowLeftRight,
    color: "text-blue-600",
    label: "Transfer",
    stripe: "bg-blue-500",
  },
};

export default function TransactionViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: t, isLoading } = useTransaction(id!);
  const deleteTransaction = useDeleteTransaction();
  const duplicateTransaction = useDuplicateTransaction();
  const toggleFlag = useToggleTransactionFlag();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitWithDebtPending, setSplitWithDebtPending] = useState(false);
  const splitTransaction = useSplitTransaction();
  const unsplitTransaction = useUnsplitTransaction();
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const linkCounterpart = useLinkCounterpart();
  const unlinkCounterpart = useUnlinkCounterpart();

  useFABActions(
    [
      {
        id: 'edit',
        label: 'Edit',
        icon: Pencil,
        onClick: () => navigate(`/transactions/${id}/edit`),
      },
      {
        id: 'back',
        label: 'Go back',
        icon: ArrowLeft,
        onClick: () => navigate(-1),
      },
    ],
    [id],
  );

  const handleDelete = () => {
    if (!id) return;
    deleteTransaction.mutate(id, {
      onSuccess: () => navigate("/transactions"),
    });
  };

  if (isLoading) {
    return (
      <Page title="Transaction">
        <div className="p-8 text-muted-foreground text-sm">Loading…</div>
      </Page>
    );
  }
  if (!t) {
    return (
      <Page title="Transaction">
        <div className="p-8 text-muted-foreground text-sm">
          Transaction not found.
        </div>
      </Page>
    );
  }

  const cfg = TYPE_CONFIG[t.type];
  const Icon = cfg.icon;
  const decimals = t.account.currency?.decimals ?? 2;
  const symbol = t.account.currency?.symbol;
  const hasConnections = t.recurringId || t.linkedTransactionId || t.debtId;
  const hasFlags =
    t.tags.length > 0 || t.isOneTime || t.isExcluded || !t.isApproved;

  return (
    <Page title="Transaction">
      <div className="max-w-2xl mx-auto p-4 pb-12 space-y-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to="/transactions"
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            Transactions
          </Link>
          <span>/</span>
          <span>
            {new Date(t.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Hero card */}
        <Card className="overflow-hidden">
          <div className={cn("h-1", cfg.stripe)} />
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  cfg.color,
                )}
              >
                <Icon className="size-4" />
                {cfg.label}
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(t.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="text-4xl font-bold font-mono tracking-tight">
              <AmountText
                value={t.amount}
                decimals={decimals}
                currency={symbol}
              />
            </div>

            {t.description && (
              <p className="text-muted-foreground text-sm">{t.description}</p>
            )}

            {hasFlags && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {t.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    #{tag.name}
                  </Badge>
                ))}
                {t.isOneTime && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal gap-1"
                  >
                    <Star className="size-3" />
                    One-time
                  </Badge>
                )}
                {t.isExcluded && (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal gap-1"
                  >
                    <Ban className="size-3" />
                    Excluded
                  </Badge>
                )}
                {!t.isApproved && (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal gap-1 border-amber-500 text-amber-600"
                  >
                    <Clock className="size-3" />
                    Pending approval
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Wallet className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground w-20 shrink-0">
                Account
              </span>
              <Link
                to={`/accounts/${t.account.id}`}
                className="text-sm font-medium hover:underline flex items-center gap-1 ml-auto"
              >
                {t.account.name}
                <ExternalLink className="size-3 text-muted-foreground" />
              </Link>
            </div>

            {t.toAccount ? (
              <div className="flex items-center gap-3 px-5 py-3.5">
                <ArrowLeftRight className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  To
                </span>
                <Link
                  to={`/accounts/${t.toAccount.id}`}
                  className="text-sm font-medium hover:underline flex items-center gap-1 ml-auto"
                >
                  {t.toAccount.name}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </Link>
              </div>
            ) : t.category ? (
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Tag className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Category
                </span>
                <div className="ml-auto">
                  <CategoryPill
                    name={t.category.name}
                    icon={t.category.icon}
                    color={t.category.color}
                    size="sm"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3 px-5 py-3.5">
              <CalendarDays className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground w-20 shrink-0">
                Date
              </span>
              <span className="text-sm font-mono ml-auto">
                {new Date(t.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {t.createdAt && (
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Clock className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Created
                </span>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  {new Date(t.createdAt).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connections */}
        {hasConnections && (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <div className="px-5 py-3">
                <p className="text-sm font-semibold">Connections</p>
              </div>
              {t.recurringId && (
                <Link
                  to={`/recurring/${t.recurringId}/edit`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <Repeat className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">
                    From recurring template
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </Link>
              )}
              {t.linkedTransactionId && (
                <div className="flex items-center gap-3 px-5 py-3">
                  <Link2 className="size-4 text-muted-foreground shrink-0" />
                  <Link
                    to={`/transactions/${t.linkedTransactionId}`}
                    className="text-sm flex-1 hover:underline"
                  >
                    Linked counterpart
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unlinkCounterpart.mutate(t.id)}
                    disabled={unlinkCounterpart.isPending}
                    className="h-7 px-2 text-xs gap-1.5"
                  >
                    <Link2Off className="size-3.5" />
                    Unlink
                  </Button>
                </div>
              )}
              {t.debtId && (
                <Link
                  to={`/debts/${t.debtId}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <Banknote className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">Debt payment</span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Split children — read-only */}
        {t.children && t.children.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <span className="text-sm font-semibold">
                  Split into {t.children.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSplitMode(true)}
                  className="h-7 text-xs gap-1.5"
                >
                  <Split className="size-3.5" />
                  Edit split
                </Button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2 text-xs text-muted-foreground font-medium">
                      Description
                    </th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                      Attribution
                    </th>
                    <th className="text-right px-5 py-2 text-xs text-muted-foreground font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {t.children.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 text-sm">
                        {c.description || (
                          <span className="text-muted-foreground italic">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {c.debtId ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Banknote className="size-3.5" />
                            Debt
                          </span>
                        ) : c.category ? (
                          <CategoryPill
                            name={c.category.name}
                            icon={c.category.icon}
                            color={c.category.color}
                            size="sm"
                          />
                        ) : (
                          <span className="text-muted-foreground italic text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm">
                        <AmountText
                          value={c.amount}
                          decimals={t.account.currency?.decimals ?? 2}
                          currency={t.account.currency?.symbol}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Split editor — modal */}
        <SplitEditor
          open={splitMode}
          onOpenChange={(v) => { if (!v) setSplitMode(false); }}
          parent={t}
          isSubmitting={splitTransaction.isPending || splitWithDebtPending}
          onUnsplit={() => {
            unsplitTransaction.mutate(t.id, {
              onSuccess: () => setSplitMode(false),
            });
          }}
          onSave={(children, pendingDebtsByRow) => {
            setSplitWithDebtPending(true);
            splitTransaction.mutate(
              { parentId: t.id, children },
              {
                onSuccess: async (result) => {
                  const pending = Object.entries(pendingDebtsByRow) as [
                    string,
                    PendingDebtForRow,
                  ][];
                  for (const [idxStr, pd] of pending) {
                    const child = result.children?.[Number(idxStr)];
                    if (child) {
                      await debtsApi.create({
                        name: pd.name,
                        debt_type: pd.debtType,
                        currency_id: t.account.currency!.id,
                        amount: child.amount,
                        origin_transaction_id: child.id,
                      });
                    }
                  }
                  setSplitWithDebtPending(false);
                  setSplitMode(false);
                },
                onError: () => setSplitWithDebtPending(false),
              },
            );
          }}
        />

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {/* Edit — primary CTA (desktop only; mobile uses StickyFooterActions) */}
          <Button asChild className="hidden md:flex w-full">
            <Link to={`/transactions/${t.id}/edit`}>
              <Pencil className="size-4 mr-2" />
              Edit
            </Link>
          </Button>

          {/* Described actions list */}
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {/* Duplicate */}
              <div className="flex items-start gap-3 px-5 py-4">
                <Copy className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">Duplicate Transaction</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Create an identical copy of this transaction on today's
                    date.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 mt-0.5"
                  onClick={() => duplicateTransaction.mutate(t.id)}
                >
                  Duplicate
                </Button>
              </div>

              {/* Approve — conditional, shown when pending */}
              {!t.isApproved && (
                <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 dark:bg-amber-950/20">
                  <CheckCircle2 className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">Approve Transaction</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This transaction is pending. Approving it includes it in
                      reports and balance calculations.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 mt-0.5 bg-amber-600 hover:bg-amber-700"
                    onClick={() =>
                      toggleFlag.mutate({
                        id: t.id,
                        flag: "is_approved",
                        value: true,
                      })
                    }
                    disabled={toggleFlag.isPending}
                  >
                    Approve
                  </Button>
                </div>
              )}

              {/* Exclude */}
              <div
                className={cn(
                  "flex items-start gap-3 px-5 py-4",
                  t.isExcluded && "bg-muted/40",
                )}
              >
                <Ban
                  className={cn(
                    "size-4 shrink-0 mt-0.5",
                    t.isExcluded ? "text-foreground" : "text-muted-foreground",
                  )}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">Exclude</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.isExcluded
                      ? "Currently excluded from budgeting calculations and reports."
                      : "Excluded transactions will be removed from budgeting calculations and reports."}
                  </p>
                </div>
                <Button
                  variant={t.isExcluded ? "secondary" : "outline"}
                  size="sm"
                  className="shrink-0 mt-0.5"
                  onClick={() =>
                    toggleFlag.mutate({
                      id: t.id,
                      flag: "is_excluded",
                      value: !t.isExcluded,
                    })
                  }
                  disabled={toggleFlag.isPending || !!t.isOneTime}
                  title={
                    t.isOneTime ? "Cannot exclude a one-time transaction" : ""
                  }
                >
                  {t.isExcluded ? "Remove" : "Exclude"}
                </Button>
              </div>

              {/* One-time */}
              <div
                className={cn(
                  "flex items-start gap-3 px-5 py-4",
                  t.isOneTime && "bg-muted/40",
                )}
              >
                <Star
                  className={cn(
                    "size-4 shrink-0 mt-0.5",
                    t.isOneTime ? "text-foreground" : "text-muted-foreground",
                  )}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">One-time {cfg.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    One-time transactions will be excluded from certain
                    budgeting calculations and reports to help you see what's
                    really important.
                  </p>
                </div>
                <Button
                  variant={t.isOneTime ? "secondary" : "outline"}
                  size="sm"
                  className="shrink-0 mt-0.5"
                  onClick={() =>
                    toggleFlag.mutate({
                      id: t.id,
                      flag: "is_one_time",
                      value: !t.isOneTime,
                    })
                  }
                  disabled={toggleFlag.isPending || !!t.isExcluded}
                  title={
                    t.isExcluded
                      ? "Cannot mark excluded transaction as one-time"
                      : ""
                  }
                >
                  {t.isOneTime ? "Remove" : "Mark"}
                </Button>
              </div>

              {/* Split — conditional */}
              {!t.children?.length && (
                <div className="flex items-start gap-3 px-5 py-4">
                  <Split className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">Split Transaction</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Split this transaction into multiple entries with
                      different categories and amounts.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 mt-0.5"
                    onClick={() => setSplitMode(true)}
                  >
                    Split
                  </Button>
                </div>
              )}

              {/* Link counterpart — conditional */}
              {!t.linkedTransactionId &&
                !t.parentId &&
                t.type !== "transfer" && (
                  <div className="flex items-start gap-3 px-5 py-4">
                    <Link2 className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        Transfer or Debt Payment?
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Connect this transaction to its counterpart in another
                        account.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 mt-0.5"
                      onClick={() => setLinkPickerOpen(true)}
                    >
                      Open matcher
                    </Button>
                  </div>
                )}

              {/* Create recurring — conditional */}
              {!t.parentId && (
                <div className="flex items-start gap-3 px-5 py-4">
                  <Repeat className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">
                      Create Recurring Template
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Turn this transaction into a recurring rule that
                      auto-creates future entries on a schedule.
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="shrink-0 mt-0.5"
                  >
                    <Link to={`/recurring/create?from_transaction=${t.id}`}>
                      Mark Recurring
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete — desktop only; mobile uses StickyFooterActions */}
          <div className="hidden md:flex justify-end pt-1">
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteTransaction.isPending}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4 mr-1.5" />
              {deleteTransaction.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </div>

      <CounterpartLinkPicker
        source={t}
        open={linkPickerOpen}
        onOpenChange={setLinkPickerOpen}
        isSubmitting={linkCounterpart.isPending}
        onPick={(targetId) => {
          linkCounterpart.mutate(
            { idA: t.id, idB: targetId },
            { onSuccess: () => setLinkPickerOpen(false) },
          );
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {t.children && t.children.length > 0
                ? `This will also delete ${t.children.length} split children and reverse their debt effects.`
                : "This will reverse the account balance and any linked debt effects."}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTransaction.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTransaction.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTransaction.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StickyFooterActions>
        <Button
          variant="destructive"
          disabled={deleteTransaction.isPending}
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="size-4 mr-2" />
          Delete
        </Button>
        <Button asChild className="flex-1">
          <Link to={`/transactions/${t.id}/edit`}>
            <Pencil className="size-4 mr-2" />
            Edit
          </Link>
        </Button>
      </StickyFooterActions>
    </Page>
  );
}
