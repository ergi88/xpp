import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileFooterNav } from "./MobileFooterNav";
import { PWAUpdateBanner } from "./PWAUpdateBanner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings, useRunDueRecurring } from "@/hooks";
import { cn } from "@/lib/utils";
import { PageTitleProvider } from "@/lib/page-title-context";

export function AppLayout() {
  const isMobile = useIsMobile();
  const { data: settings } = useSettings();
  const runDue = useRunDueRecurring();
  const didRunRef = useRef(false);
  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    runDue.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const footerEnabled = settings?.mobile_footer_enabled ?? true;
  const showFooter = isMobile && footerEnabled;

  return (
    <PageTitleProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <PWAUpdateBanner />
          <Header />
          <main
            className={cn("flex-1 overflow-y-auto p-6", showFooter && "pb-24")}
          >
            <Outlet />
          </main>
          <MobileFooterNav />
        </SidebarInset>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
