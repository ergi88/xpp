import { type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/hooks";
import { cn } from "@/lib/utils";

interface StickyFooterActionsProps {
  children: ReactNode;
  className?: string;
}

export function StickyFooterActions({
  children,
  className,
}: StickyFooterActionsProps) {
  const isMobile = useIsMobile();
  const { data: settings } = useSettings();
  const footerEnabled = settings?.mobile_footer_enabled ?? true;
  const showMobileFooter = isMobile && footerEnabled;

  if (isMobile) {
    return (
      <div
        className={cn(
          "fixed inset-x-0 z-30 flex w-full items-center gap-2 border-t bg-background! p-4",
          className,
        )}
        style={{
          bottom: showMobileFooter
            ? "calc(env(safe-area-inset-bottom) + 5.5rem)"
            : "env(safe-area-inset-bottom)",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 flex w-full items-center gap-2 border-t bg-background! p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
