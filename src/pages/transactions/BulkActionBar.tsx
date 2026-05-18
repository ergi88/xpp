import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category } from '@/types/categories'

interface BulkEditValues {
  categoryId?: string
}

interface BulkActionBarProps {
  selectedCount: number
  totalSelectableCount: number
  categories: Category[]
  onClearSelection: () => void
  onBulkDelete: () => void
  onBulkEdit: (values: BulkEditValues) => void
}

export function BulkActionBar({
  selectedCount,
  totalSelectableCount,
  categories,
  onClearSelection,
  onBulkDelete,
  onBulkEdit,
}: BulkActionBarProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editCategoryId, setEditCategoryId] = useState('')

  if (selectedCount === 0) return null

  const label =
    selectedCount === 1
      ? '1 transaction selected'
      : `${selectedCount} transactions selected`

  const checkboxChecked =
    selectedCount === totalSelectableCount && totalSelectableCount > 0
      ? true
      : selectedCount > 0
        ? 'indeterminate'
        : false

  function handleApplyEdit() {
    onBulkEdit({ categoryId: editCategoryId })
    setEditOpen(false)
    setEditCategoryId('')
  }

  function handleCancelEdit() {
    setEditOpen(false)
    setEditCategoryId('')
  }

  function handleConfirmDelete() {
    onBulkDelete()
    setDeleteOpen(false)
  }

  return (
    <>
      {/* Floating bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-background shadow-lg px-4 py-2.5">
        <Checkbox
          checked={checkboxChecked}
          onCheckedChange={() => onClearSelection()}
        />
        <div className="h-4 w-px bg-border" />
        <span className="text-sm">{label}</span>
        <div className="h-4 w-px bg-border" />
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

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) handleCancelEdit() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {label.replace(' selected', '')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Change category</label>
            <Select value={editCategoryId} onValueChange={setEditCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button disabled={!editCategoryId} onClick={handleApplyEdit}>
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
              Delete {selectedCount} {selectedCount === 1 ? 'transaction' : 'transactions'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected transactions will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete {selectedCount} {selectedCount === 1 ? 'transaction' : 'transactions'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
