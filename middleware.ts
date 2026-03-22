import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  console.log('[middleware] path:', request.nextUrl.pathname)

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('auth-token'))

  console.log('[middleware] isAuthRoute:', isAuthRoute, 'hasAuthCookie:', hasAuthCookie)

  if (!hasAuthCookie && !isAuthRoute) {
    console.log('[middleware] redirecting to /auth/login')
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (hasAuthCookie && isAuthRoute) {
    console.log('[middleware] redirecting to /')
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  console.log('[middleware] passing through')
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
