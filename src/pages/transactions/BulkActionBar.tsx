import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelect } from "@/components/shared/CategorySelect";

interface BulkEditValues {
  categoryId?: string;
  isOneTime?: boolean | null;
  isExcluded?: boolean | null;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalSelectableCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkEdit: (values: BulkEditValues) => void;
}

export function BulkActionBar({
  selectedCount,
  totalSelectableCount,
  onClearSelection,
  onBulkDelete,
  onBulkEdit,
}: BulkActionBarProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editIsOneTime, setEditIsOneTime] = useState<boolean | null>(null);
  const [editIsExcluded, setEditIsExcluded] = useState<boolean | null>(null);

  if (selectedCount === 0) return null;

  const label =
    selectedCount === 1
      ? "1 transaction selected"
      : `${selectedCount} transactions selected`;

  const checkboxChecked =
    selectedCount === totalSelectableCount && totalSelectableCount > 0
      ? true
      : selectedCount > 0
        ? "indeterminate"
        : false;

  function handleApplyEdit() {
    onBulkEdit({
      categoryId: editCategoryId || undefined,
      isOneTime: editIsOneTime,
      isExcluded: editIsExcluded,
    });
    setEditOpen(false);
    setEditCategoryId("");
    setEditIsOneTime(null);
    setEditIsExcluded(null);
  }

  function handleCancelEdit() {
    setEditOpen(false);
    setEditCategoryId("");
    setEditIsOneTime(null);
    setEditIsExcluded(null);
  }

  const hasAnyEdit =
    !!editCategoryId || editIsOneTime !== null || editIsExcluded !== null;

  function handleConfirmDelete() {
    onBulkDelete();
    setDeleteOpen(false);
  }

  return (
    <>
      {/* Floating bar */}
      <div className="fixed bottom-6 z-50 left-4 right-4 md:left-1/2 md:right-auto md:w-auto md:-translate-x-1/2 flex items-center justify-between gap-3 rounded-full border bg-background shadow-lg px-4 py-2.5">
        <Checkbox
          checked={checkboxChecked}
          onCheckedChange={() => onClearSelection()}
        />
        <div className="h-4 w-px bg-border" />
        <span className="text-sm">{label}</span>
        <div className="h-4 w-px bg-border" />
        <div>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Bulk edit"
            onClick={() => setEditOpen(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete selected"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelEdit();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {label.replace(" selected", "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Change category</label>
              <CategorySelect
                value={editCategoryId || null}
                onChange={setEditCategoryId}
                placeholder="No change"
                withFormControl={false}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">One time</label>
              <Select
                value={
                  editIsOneTime === null ? "__none__" : String(editIsOneTime)
                }
                onValueChange={(v) =>
                  setEditIsOneTime(v === "__none__" ? null : v === "true")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No change</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Exclude from totals</label>
              <Select
                value={
                  editIsExcluded === null ? "__none__" : String(editIsExcluded)
                }
                onValueChange={(v) =>
                  setEditIsExcluded(v === "__none__" ? null : v === "true")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No change</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button disabled={!hasAnyEdit} onClick={handleApplyEdit}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount}{" "}
              {selectedCount === 1 ? "transaction" : "transactions"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected transactions will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete {selectedCount}{" "}
              {selectedCount === 1 ? "transaction" : "transactions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
