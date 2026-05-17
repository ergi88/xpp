import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { useCategories } from "@/hooks";
import { CategoryPill } from './CategoryPill'

interface CategorySelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  type: "income" | "expense";
  placeholder?: string;
  disabled?: boolean;
  sortByPopularity?: boolean;
  withFormControl?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  type,
  placeholder = "Select category",
  disabled,
  sortByPopularity = true,
  withFormControl = true,
}: CategorySelectProps) {
  const { data: categories } = useCategories();

  const filteredCategories = useMemo(() => {
    const filtered = categories?.filter((c) => c.type === type) ?? [];
    if (sortByPopularity) {
      return filtered.sort(
        (a, b) => (b.transactionsCount ?? 0) - (a.transactionsCount ?? 0),
      );
    }
    return filtered;
  }, [categories, type, sortByPopularity]);

  return (
    <Select
      onValueChange={(val) => onChange(val)}
      value={value ? value.toString() : ""}
      disabled={disabled}
    >
      {withFormControl ? (
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
        </FormControl>
      ) : (
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      )}
      <SelectContent>
        {filteredCategories.map((category) => (
          <SelectItem key={category.id} value={category.id.toString()}>
            <CategoryPill
              name={category.name}
              icon={category.icon}
              color={category.color}
              size="sm"
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
