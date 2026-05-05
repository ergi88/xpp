import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient } from '@/lib/query-client'
import { persister } from '@/lib/persister'
import { Toaster } from 'sonner'

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
      <Toaster position="top-right" richColors />
    </PersistQueryClientProvider>
  )
}
