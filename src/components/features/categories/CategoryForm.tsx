import { useWatch, useForm } from "react-hook-form";
import { motion } from "motion/react";
import { Check, Palette, Sparkles, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import { categorySchema, CategoryFormData } from "@/schemas";
import { CATEGORY_COLORS } from "@/constants";
import { CategoryIcon } from "@/lib/category-icon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { StickyFooterActions } from "@/components/shared";
import { LucideIconPicker } from "./LucideIconPicker";

interface CategoryFormProps {
  defaultValues?: Partial<CategoryFormData>;
  onSubmit: (data: CategoryFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

type CategoryType = CategoryFormData["type"];

const TYPE_META: Record<
  CategoryType,
  { label: string; text: string; bg: string; border: string }
> = {
  income: {
    label: "Income",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  expense: {
    label: "Expense",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
};

function GlassField({
  label,
  sub,
  icon: Icon,
  iconClassName,
  children,
}: {
  label: string;
  sub?: string;
  icon?: typeof TagIcon;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
        {Icon && <Icon className={cn("size-3", iconClassName)} />}
        {label.toUpperCase()}
      </div>
      {sub && (
        <p className="-mt-1 mb-2 text-[11px] leading-snug text-muted-foreground">
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

export function CategoryForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: CategoryFormProps) {
  const form = useForm<CategoryFormData>({
    resolver: safeZodResolver<CategoryFormData>(categorySchema),
    defaultValues: {
      name: "",
      type: "expense",
      icon: "House",
      color: "#60a5fa",
      ...defaultValues,
    },
  });

  const type = useWatch({ control: form.control, name: "type" });
  const name = useWatch({ control: form.control, name: "name" });
  const icon = useWatch({ control: form.control, name: "icon" });
  const color = useWatch({ control: form.control, name: "color" });

  const meta = TYPE_META[type];

  const handleInvalid = (errors: Record<string, { message?: string }>) => {
    const messages = Object.entries(errors)
      .map(([field, err]) => err?.message ?? `${field} is invalid`)
      .filter(Boolean);
    if (messages.length > 0) {
      toast.error(messages[0], {
        description:
          messages.length > 1
            ? `+${messages.length - 1} more issue(s)`
            : undefined,
      });
    }
  };

  const isValid = (name ?? "").trim().length >= 2 && !!icon && !!color;

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
          className="space-y-3 pb-28"
        >
          {/* Type tabs */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <div className="relative flex gap-1 rounded-2xl border border-border bg-card/80 p-1 backdrop-blur-xl">
                  {(Object.keys(TYPE_META) as CategoryType[]).map((key) => {
                    const m = TYPE_META[key];
                    const active = field.value === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => field.onChange(key)}
                        className={cn(
                          "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="category-type-tab-bg"
                            className={cn(
                              "absolute inset-0 rounded-xl border",
                              m.bg,
                              m.border,
                            )}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 30,
                            }}
                          />
                        )}
                        <span className={cn("relative z-10", active && m.text)}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Hero preview */}
          <div
            className="relative overflow-hidden rounded-3xl border p-6 transition"
            style={{
              backgroundColor: `${color}1a`,
              borderColor: `${color}4d`,
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-full flex border border-border bg-background/40 px-2.5 py-1 backdrop-blur">
                <span
                  className="text-[10px] font-semibold tracking-wider"
                  style={{ color }}
                >
                  PREVIEW
                </span>
              </div>
              <div className={cn("text-[10px]", meta.text)}>{meta.label}</div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                className="grid size-20 place-items-center rounded-3xl"
                style={{ backgroundColor: `${color}26` }}
              >
                <CategoryIcon name={icon} color={color} size={40} />
              </div>
              <div className="max-w-full truncate text-lg font-semibold">
                {name || "Category name"}
              </div>
            </div>
          </div>

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Name"
                  icon={TagIcon}
                  iconClassName="text-violet-500"
                >
                  <FormControl>
                    <Input
                      placeholder="e.g. Groceries"
                      {...field}
                      className="h-9 border-0 bg-transparent p-0 text-base font-medium shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Icon */}
          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Icon"
                  icon={Sparkles}
                  iconClassName="text-fuchsia-500"
                >
                  <LucideIconPicker
                    value={field.value}
                    onChange={field.onChange}
                    color={color}
                  />
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Color */}
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Color"
                  icon={Palette}
                  iconClassName="text-fuchsia-500"
                >
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_COLORS.map((c) => {
                      const selected =
                        field.value?.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => field.onChange(c)}
                          aria-label={`Select color ${c}`}
                          className={cn(
                            "grid size-8 place-items-center rounded-full border-2 transition",
                            selected
                              ? "scale-110 border-foreground"
                              : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: c }}
                        >
                          {selected && (
                            <Check className="size-4 text-white drop-shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Sticky submit */}
          <StickyFooterActions className="bg-unset">
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={cn(
                "h-10 w-full rounded-xl font-semibold shadow-lg transition disabled:opacity-100",
                isValid ? "text-white" : "bg-muted text-muted-foreground",
              )}
              style={
                isValid
                  ? {
                      backgroundColor: color,
                      boxShadow: `0 10px 25px ${color}4d`,
                    }
                  : undefined
              }
            >
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </StickyFooterActions>
        </form>
      </Form>
    </FormWrapper>
  );
}
