import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from './lib/sessionOptions'
import type { SessionData } from './lib/types'

const PROTECTED = ['/repos', '/confirm', '/done']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PROTECTED.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    const response = NextResponse.next()
    try {
      const session = await getIronSession<SessionData>(request, response, sessionOptions)
      if (!session.accessToken) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    } catch {
      // Corrupted or unreadable cookie — treat as unauthenticated
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/repos/:path*', '/confirm/:path*', '/done/:path*'],
}
