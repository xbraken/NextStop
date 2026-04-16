import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const isAuthed = token ? !!(await verifyToken(token)) : false

  if (!isAuthed) {
    return NextResponse.redirect(new URL('/profile', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /profile (login/register page)
     * - /api/auth/* (auth endpoints)
     * - _next/static, _next/image, favicon, manifest, icons (Next.js internals + PWA assets)
     */
    '/((?!profile|api|_next/static|_next/image|favicon|manifest|icon).*)',
  ],
}
