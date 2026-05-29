import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from './lib/sessionOptions'
import type { SessionData } from './lib/types'

const PROTECTED = ['/repos', '/confirm', '/done']

/**
 * Next.js edge middleware that enforces authentication on protected page routes.
 *
 * Intercepts all requests to `/repos`, `/confirm`, and `/done` (and any
 * sub-paths). Reads the `depo_session` cookie via `getIronSession`; redirects
 * to `/` if no `accessToken` is present or if the cookie cannot be decrypted
 * (tampered or encrypted with a different secret). All other paths pass through
 * unmodified.
 *
 * @param request - The incoming Next.js edge request.
 * @returns A redirect to `/` for unauthenticated requests on protected paths,
 *   or an unmodified pass-through `NextResponse` for everything else.
 */
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
