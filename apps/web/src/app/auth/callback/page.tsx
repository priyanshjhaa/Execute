'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback URL:', window.location.href)
        console.log('URL search:', window.location.search)
        console.log('URL hash:', window.location.hash)

        // First, try to get the current session (Supabase might have already set it)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (session) {
          setStatus('success')
          setMessage('Authentication successful! Redirecting to dashboard...')
          setTimeout(() => {
            router.push('/dashboard')
          }, 1000)
          return
        }

        // If no session, check for error in URL
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const error = searchParams.get('error') || hashParams.get('error')
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')

        if (error) {
          setStatus('error')
          setMessage(errorDescription || 'Authentication failed. Please try again.')
          console.error('Auth error:', error, errorDescription)
          return
        }

        // Try to parse tokens from hash
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        console.log('Access token from hash:', accessToken ? 'Found' : 'Not found')
        console.log('Refresh token from hash:', refreshToken ? 'Found' : 'Not found')

        if (accessToken && refreshToken) {
          const { data, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setError) {
            setStatus('error')
            setMessage(setError.message)
            console.error('Session set error:', setError)
            return
          }

          setStatus('success')
          setMessage('Signed in successfully! Redirecting to dashboard...')

          setTimeout(() => {
            router.push('/dashboard')
          }, 1000)
        } else {
          // No tokens found - this might be an email confirmation link
          // Try to parse from query params as fallback
          const queryAccessToken = searchParams.get('access_token')
          const queryRefreshToken = searchParams.get('refresh_token')

          console.log('Access token from query:', queryAccessToken ? 'Found' : 'Not found')

          if (queryAccessToken && queryRefreshToken) {
            const { data, error: setError } = await supabase.auth.setSession({
              access_token: queryAccessToken,
              refresh_token: queryRefreshToken,
            })

            if (setError) {
              setStatus('error')
              setMessage(setError.message)
              return
            }

            setStatus('success')
            setMessage('Authentication successful! Redirecting to dashboard...')

            setTimeout(() => {
              router.push('/dashboard')
            }, 1000)
          } else {
            setStatus('error')
            setMessage('Invalid authentication link. Please try signing in again.')
            console.error('No tokens found in URL')
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setStatus('error')
        setMessage('An unexpected error occurred during authentication.')
      }
    }

    handleAuthCallback()
  }, [router, supabase])

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Terminal className="h-8 w-8 text-white" />
            <span className="text-2xl font-semibold text-white">Execute</span>
          </div>

          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-white/60 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-16 w-16 text-red-500" />
            )}
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-white mb-3">
            {status === 'loading' && 'Confirming your email...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Confirmation Failed'}
          </h1>

          <p className="text-white/60 mb-8">
            {message || 'Please wait while we confirm your email address.'}
          </p>

          {/* Actions */}
          {status === 'error' && (
            <div className="space-y-4">
              <button
                onClick={() => router.push('/login')}
                className="w-full px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}

          {status === 'success' && (
            <p className="text-sm text-white/40">
              You will be redirected automatically...
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
