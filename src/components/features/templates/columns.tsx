import { Link } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import {
  Pencil,
  Trash2,
  MoreHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { AmountText } from "@/components/shared/AmountText";
import { CategoryPill } from "@/components/shared";
import { TransactionTemplate } from "@/types";
import { cn } from "@/lib/utils";

const typeConfig = {
  income: { icon: ArrowDownLeft, color: "text-green-500", label: "Income" },
  expense: { icon: ArrowUpRight, color: "text-red-500", label: "Expense" },
  transfer: { icon: ArrowLeftRight, color: "text-blue-500", label: "Transfer" },
};

interface ColumnsOptions {
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}

export const createTemplateColumns = ({
  onDelete,
  isReadOnly,
}: ColumnsOptions): ColumnDef<TransactionTemplate>[] => [
  {
    accessorKey: "name",
    header: "Template",
    cell: ({ row }) => {
      const config =
        typeConfig[row.original.type as keyof typeof typeConfig] ??
        typeConfig.expense;
      const Icon = config?.icon || ArrowUpRight;
      return (
        <div className="flex items-center gap-3">
          <div className={cn("grid size-9 place-items-center rounded-full bg-muted text-base", config.color)}>
            {row.original.icon || <Icon className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-medium">{row.original.name || config.label}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.account?.name ?? "—"}
              {row.original.type === "transfer" && row.original.toAccount && (
                <> → {row.original.toAccount.name}</>
              )}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      if (row.original.amount == null) {
        return <span className="text-muted-foreground">Variable</span>;
      }
      return (
        <span
          className={cn(
            "font-mono font-medium",
            row.original.type === "income" && "text-green-600",
            row.original.type === "expense" && "text-red-600",
          )}
        >
          <AmountText
            value={
              row.original.type === "expense"
                ? -row.original.amount
                : row.original.amount
            }
            decimals={row.original.account?.currency?.decimals ?? 2}
            currency={row.original.account?.currency?.symbol}
          />
        </span>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      if (!row.original.category)
        return <span className="text-muted-foreground">-</span>;
      return (
        <CategoryPill
          name={row.original.category.name}
          icon={row.original.category.icon}
          color={row.original.category.color}
          size="sm"
        />
      );
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) =>
      row.original.tags.length > 0 ? (
        <Badge variant="outline">{row.original.tags.length} tag(s)</Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/templates/${row.original.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          {!isReadOnly && (
            <>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete template?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This template will be
                      permanently deleted. Transactions already created from it
                      are not affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(row.original.id)}
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
    ),
  },
];
