import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient } from "@/lib/query-client";
import { persister } from "@/lib/persister";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      }}
    >
      {children}
      <Toaster
        offset={{ top: 60 }}
        mobileOffset={{ top: 60 }}
        position="top-center"
        richColors
      />
    </PersistQueryClientProvider>
  );
}
