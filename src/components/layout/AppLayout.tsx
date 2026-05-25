import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileFooterNav } from "./MobileFooterNav";
import { MobileFooterNavSimple } from "./footer-nav-examples/MobileFooterNavSimple";
import { DraggableFAB } from "./DraggableFAB";
import { PWAUpdateBanner } from "./PWAUpdateBanner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { FABProvider } from "@/lib/fab-context";
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
      <FABProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <PWAUpdateBanner />
            <Header />
            <main
              className={cn(
                "flex-1 overflow-y-auto py-6 px-2 lg:p-6 max-h-[calc(100dvh-56px)]",
                showFooter && "pb-28",
              )}
            >
              <Outlet />
            </main>
            <MobileFooterNav />
            {/* <MobileFooterNavSimple /> */}
          </SidebarInset>
          {isMobile && <DraggableFAB />}
        </SidebarProvider>
      </FABProvider>
    </PageTitleProvider>
  );
}
