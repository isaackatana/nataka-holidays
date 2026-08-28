import { type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/features/auth/AuthContext'
import { TripCartProvider } from '@/features/tripCart/TripCartContext'

/**
 * Root provider stack. AuthProvider must sit *inside* QueryClientProvider
 * since it uses useQuery internally for the profile fetch. TripCartProvider
 * doesn't depend on either — it's plain localStorage-backed state — but
 * sits alongside AuthProvider since both are app-wide client state
 * available from any page.
 *
 * NOTE: this app will throw at runtime until a real Supabase project is
 * connected via .env.local (see supabase/README.md) — src/lib/supabase.ts
 * fails fast rather than silently calling `undefined`.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TripCartProvider>{children}</TripCartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  )
}
