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

  if (!isMobile) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t bg-background flex items-center gap-2 px-4 py-3",
        className,
      )}
      style={{
        bottom: showMobileFooter
          ? "calc(env(safe-area-inset-bottom) + 5rem)"
          : "env(safe-area-inset-bottom)",
      }}
    >
      {children}
    </div>
  );
}
