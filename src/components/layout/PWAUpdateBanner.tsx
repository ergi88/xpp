import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function PWAUpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-primary px-4 py-2 text-primary-foreground text-sm">
      <span>New version available.</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 gap-1.5 shrink-0"
        onClick={() => updateServiceWorker(true)}
      >
        <RefreshCw className="size-3.5" />
        Update
      </Button>
    </div>
  );
}
