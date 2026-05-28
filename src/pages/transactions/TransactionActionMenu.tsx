import { Link } from "react-router-dom";
import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DeleteTransactionAlertContent } from "@/components/features/transactions";
import { Transaction } from "@/types";

interface TransactionActionMenuProps {
  transaction: Transaction;
  onDelete: (id: string, opts?: { skipEffects?: boolean }) => void;
  onDuplicate: (id: string) => void;
}

export function TransactionActionMenu({
  transaction,
  onDelete,
  onDuplicate,
}: TransactionActionMenuProps) {
  return (
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
            <DeleteTransactionAlertContent
              description="This action cannot be undone."
              onConfirm={(opts) => onDelete(transaction.id, opts)}
            />
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
