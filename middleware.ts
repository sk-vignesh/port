import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('auth-token'))

  if (!hasAuthCookie && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (hasAuthCookie && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
