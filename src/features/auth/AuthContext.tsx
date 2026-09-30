import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profiles.service'
import type { Profile } from '@/types/domain'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** True while the initial session is being resolved on page load. */
  loading: boolean
  /** True while the profile row is being fetched for a known user. */
  profileLoading: boolean
  isAdmin: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      // Profile is keyed by user id in React Query, so a user switch
      // (sign out -> sign in as someone else) naturally refetches rather
      // than showing stale data from the previous session.
      setLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  })

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    queryClient.removeQueries({ queryKey: ['profile'] })
    // Payment data is per-user (RLS-scoped): drop it so the next person on
    // a shared device never briefly sees the previous user's payments.
    queryClient.removeQueries({ queryKey: ['payments'] })
    queryClient.removeQueries({ queryKey: ['my-bookings'] })
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const value: AuthContextValue = {
    session,
    user,
    profile: profile ?? null,
    loading,
    profileLoading,
    isAdmin: profile?.role === 'admin',
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
