import { Providers } from './providers'
import { RouterProvider } from 'react-router-dom'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { router } from './router'
import { SetupGate } from '@/auth/SetupGate'
import { AuthGate } from '@/auth/AuthGate'

export function App() {
  return (
    <Providers>
      <SetupGate>
        <AuthGate>
          <NuqsAdapter>
            <RouterProvider router={router} />
          </NuqsAdapter>
        </AuthGate>
      </SetupGate>
    </Providers>
  )
}
