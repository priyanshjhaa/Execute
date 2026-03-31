'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { EmailOtpType } from '@supabase/supabase-js'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = getSupabaseBrowserClient()

      try {
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash')
        const otpType = searchParams.get('type') as EmailOtpType | null
        const urlError = searchParams.get('error') || hashParams.get('error')
        const urlErrorDescription =
          searchParams.get('error_description') || hashParams.get('error_description')

        if (urlError) {
          setStatus('error')
          setMessage(urlErrorDescription || 'Authentication failed. Please try again.')
          return
        }

        // Supabase PKCE flows return an auth code that must be exchanged for a session.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            setStatus('error')
            setMessage(error.message)
            return
          }
        }

        // Email confirmation links can arrive as token_hash + type.
        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          })

          if (error) {
            setStatus('error')
            setMessage(error.message)
            return
          }
        }

        // First, try to get the current session after any exchange/verification step.
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              supabaseId: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata?.name,
            }),
          }).catch(() => null)

          setStatus('success')
          setMessage('Authentication successful! Redirecting to dashboard...')
          setTimeout(() => {
            router.replace('/dashboard')
          }, 1000)
          return
        }

        // Legacy token-in-hash fallback.
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error: setError } = await supabase.auth.setSession({
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
            router.replace('/dashboard')
          }, 1000)
        } else {
          const queryAccessToken = searchParams.get('access_token')
          const queryRefreshToken = searchParams.get('refresh_token')

          if (queryAccessToken && queryRefreshToken) {
            const { error: setError } = await supabase.auth.setSession({
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
              router.replace('/dashboard')
            }, 1000)
          } else {
            setStatus('error')
            setMessage('Invalid authentication link. Please try signing in again.')
          }
        }
      } catch (err) {
        setStatus('error')
        setMessage('An unexpected error occurred during authentication.')
      }
    }

    handleAuthCallback()
  }, [router])

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
