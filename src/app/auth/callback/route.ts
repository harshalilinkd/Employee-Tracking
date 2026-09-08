import { NextResponse, type NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'

/** OAuth ("Continue with Google") and magic-link return path. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  /**
   * Behind Vercel's proxy, request.nextUrl.origin is the internal upstream
   * address, not the address the browser used. Redirecting to it would send
   * the user somewhere unreachable straight after a successful sign-in, so
   * the forwarded host wins when it is present.
   */
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  // Only ever redirect within this app — an open redirect here would let a
  // crafted ?next= bounce a freshly signed-in user to another site.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (code) {
    const supabase = await createAuthClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${base}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth`)
}
