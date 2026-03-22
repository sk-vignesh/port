import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')

  // Check for Supabase auth cookie (no Supabase SDK needed)
  // Supabase stores session in cookies like: sb-<ref>-auth-token or sb-<ref>-auth-token.0, .1, etc.
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('auth-token'))

  // Unauthenticated → redirect to login (unless already on auth page)
  if (!hasAuthCookie && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Authenticated → redirect away from auth pages
  if (hasAuthCookie && isAuthRoute) {
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
