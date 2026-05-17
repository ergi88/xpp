import { ColumnDef } from "@tanstack/react-table";
import { Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AmountText } from "@/components/shared/AmountText";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  income: {
    icon: ArrowDownLeft,
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Income",
  },
  expense: {
    icon: ArrowUpRight,
    color: "text-red-600",
    bg: "bg-red-100",
    label: "Expense",
  },
  transfer: {
    icon: ArrowLeftRight,
    color: "text-blue-600",
    bg: "bg-blue-100",
    label: "Transfer",
  },
};

export function createTransactionColumns(
  onDelete: (id: string) => void,
  onDuplicate: (id: string) => void,
  isReadOnly?: boolean,
): ColumnDef<Transaction>[] {
  return [
    {
      id: "expand",
      header: "",
      size: 32,
      cell: ({ row }) => {
        const childrenCount =
          row.original.childrenCount ?? row.original.children?.length ?? 0;
        if (childrenCount < 1) return null;
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              row.toggleExpanded();
            }}
            className="size-6"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                row.getIsExpanded() && "rotate-90",
              )}
            />
          </Button>
        );
      },
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {new Date(row.original.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.type;
        const config = TYPE_CONFIG[type];
        const Icon = config.icon;
        return (
          <Badge
            variant="secondary"
            className={cn("gap-1", config.bg, config.color)}
          >
            <Icon className="size-3" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const {
          description,
          category,
          account,
          toAccount,
          type,
          childrenCount,
          tags,
          isExcluded,
          isOneTime,
          isApproved,
          recurringId,
          linkedTransactionId,
          debtId,
        } = row.original;

        const getDefaultDescription = () => {
          if (type === "transfer")
            return `${account.name} → ${toAccount?.name}`;
          return category?.name;
        };

        const getSubDescription = () => {
          if (type === "transfer") {
            return (
              <span>
                {account.name} → {toAccount?.name}
              </span>
            );
          }
          return (
            <span>
              {account.name}
              {category && ` · ${category.icon} ${category.name}`}
            </span>
          );
        };

        const hasBadges =
          isExcluded ||
          isOneTime ||
          !isApproved ||
          recurringId ||
          linkedTransactionId ||
          debtId;

        return (
          <div className="space-y-1">
            <div className="font-medium">
              {description || getDefaultDescription()}
              {hasBadges && (
                <span className="ml-1 inline-flex gap-1 align-middle text-xs text-muted-foreground">
                  {!isApproved && (
                    <span title="Pending approval" className="text-amber-600">
                      ⏳
                    </span>
                  )}
                  {isExcluded && <span title="Excluded">⊘</span>}
                  {isOneTime && <span title="One-time">★</span>}
                  {recurringId && <span title="From recurring">↻</span>}
                  {linkedTransactionId && (
                    <span title="Linked counterpart">⇄</span>
                  )}
                  {debtId && <span title="Debt payment">$</span>}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {getSubDescription()}
              {childrenCount != null && childrenCount > 0 && (
                <span className="ml-2 text-primary">
                  ({childrenCount} splits)
                </span>
              )}
            </div>
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs px-1.5 py-0"
                  >
                    #{tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => {
        const { type, amount, toAmount, account, toAccount } = row.original;
        const isIncoming = type === "income";
        const isTransfer = type === "transfer";

        return (
          <div className="text-right space-y-1">
            <div
              className={cn(
                "font-mono font-semibold",
                isIncoming
                  ? "text-green-600"
                  : isTransfer
                    ? "text-blue-600"
                    : "text-red-600",
              )}
            >
              <AmountText
                value={isIncoming ? amount : -amount}
                decimals={account.currency?.decimals ?? 2}
                currency={account.currency?.symbol}
                signDisplay="always"
              />
            </div>
            {isTransfer && toAmount && toAccount && (
              <div className="text-xs text-muted-foreground font-mono">
                →{" "}
                <AmountText
                  value={toAmount}
                  decimals={toAccount.currency?.decimals ?? 2}
                  currency={toAccount.currency?.symbol}
                  signDisplay="always"
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const transaction = row.original;
        return (
          // Wrap in div with stopPropagation so AlertDialog clicks inside
          // the portaled menu don't bubble up via React's synthetic event
          // system and trigger the row's onClick (which navigates).
          <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem asChild>
                <Link to={`/transactions/${transaction.id}/edit`}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {!isReadOnly && (
                <>
                  <DropdownMenuItem onClick={() => onDuplicate(transaction.id)}>
                    <Copy className="mr-2 size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete this transaction and update account balances.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(transaction.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
