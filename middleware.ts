import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Guard: skip if env vars missing
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')

  // Read the Supabase auth token from cookies
  // Supabase stores the session in cookies prefixed with sb-<project-ref>-auth-token
  const allCookies = request.cookies.getAll()
  const authCookies = allCookies.filter(c => c.name.includes('auth-token'))

  // Try to verify the session by reading the access token
  let hasValidSession = false

  if (authCookies.length > 0) {
    try {
      // Supabase may chunk the cookie — reassemble if needed
      const sorted = authCookies.sort((a, b) => a.name.localeCompare(b.name))
      const raw = sorted.map(c => c.value).join('')
      const parsed = JSON.parse(raw)
      const accessToken = parsed?.access_token || parsed?.[0]?.access_token

      if (accessToken) {
        // Verify the token by calling Supabase getUser
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        })
        const { data: { user }, error } = await supabase.auth.getUser()
        hasValidSession = !!user && !error
      }
    } catch {
      // Cookie parsing failed — treat as not authenticated
      hasValidSession = false
    }
  }

  // Redirect unauthenticated users to login
  if (!hasValidSession && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (hasValidSession && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
