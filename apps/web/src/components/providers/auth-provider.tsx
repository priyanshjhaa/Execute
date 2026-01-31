'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser, AuthContextType } from '@/types/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Supabase client created:', supabase)

    // Get initial session and sync user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ? transformUser(session.user) : null
      setUser(currentUser)

      // Sync existing user to database on page load
      if (session?.user) {
        fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supabaseId: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name
          })
        }).catch(err => console.error('Failed to sync user:', err))
      }

      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ? transformUser(session.user) : null
      setUser(currentUser)

      // Sync user to database on signup/login
      if (event === 'SIGNED_IN' && session?.user) {
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supabaseId: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name
          })
        })
      }

      // Redirect on sign out
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  const transformUser = (supabaseUser: SupabaseUser): AuthUser => ({
    id: supabaseUser.id,
    email: supabaseUser.email!,
    name: supabaseUser.user_metadata?.name
  })

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    router.push('/dashboard')
    router.refresh()
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }

    // If email confirmation is enabled, show message
    // Otherwise, redirect to dashboard
    router.push('/dashboard')
    router.refresh()
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
