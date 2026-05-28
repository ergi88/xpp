import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { BottomSheet, type BottomSheetItem } from "@/components/ui/bottom-sheet";
import { useCategories } from "@/hooks";
import { CategoryIcon } from "@/lib/category-icon";
import { cn } from "@/lib/utils";

interface CategorySelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  type?: "income" | "expense";
  placeholder?: string;
  disabled?: boolean;
  sortByPopularity?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  type,
  placeholder = "Select category",
  disabled,
  sortByPopularity = true,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const { data: categories } = useCategories();

  const filtered = useMemo(() => {
    const base = type
      ? (categories?.filter((c) => c.type === type) ?? [])
      : (categories ?? []);
    if (sortByPopularity) {
      return [...base].sort(
        (a, b) => (b.transactionsCount ?? 0) - (a.transactionsCount ?? 0),
      );
    }
    return base;
  }, [categories, type, sortByPopularity]);

  const selected = filtered.find((c) => c.id === value);

  const items: BottomSheetItem[] = filtered.map((category) => ({
    id: category.id,
    label: category.name,
    color: category.color,
    iconNode: (
      <CategoryIcon name={category.icon} color={category.color} size={22} />
    ),
  }));

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left transition hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
        )}
        aria-haspopup="dialog"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {selected ? (
            <>
              <div
                className="grid size-9 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: `${selected.color}1a` }}
              >
                <CategoryIcon
                  name={selected.icon}
                  color={selected.color}
                  size={18}
                />
              </div>
              <span className="truncate text-sm font-semibold">
                {selected.name}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={placeholder}
        items={items}
        layout="grid"
        searchable={filtered.length > 8}
        selectedId={value ?? null}
        onSelect={onChange}
        emptyMessage="No categories available"
      />
    </>
  );
}
