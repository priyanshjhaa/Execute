import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name)
          return cookie?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({
              name,
              value,
              ...options,
              httpOnly: options?.httpOnly ?? true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          } catch (error) {
            // Ignore cookie setting errors in server components
            console.warn('Failed to set cookie:', error)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
            })
          } catch (error) {
            console.warn('Failed to remove cookie:', error)
          }
        },
      },
    }
  )
}
