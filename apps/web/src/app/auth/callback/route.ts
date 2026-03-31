import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function buildRedirect(request: NextRequest, pathname: string, error?: string) {
  const url = new URL(pathname, request.url)

  if (error) {
    url.searchParams.set('error', error)
  }

  return url
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') || '/dashboard'
  const error = searchParams.get('error_description') || searchParams.get('error')

  if (error) {
    return NextResponse.redirect(buildRedirect(request, '/login', error))
  }

  const supabase = await createClient()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(buildRedirect(request, '/login', exchangeError.message))
    }
  } else if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (verifyError) {
      return NextResponse.redirect(buildRedirect(request, '/login', verifyError.message))
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
