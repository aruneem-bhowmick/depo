import type { SessionOptions } from 'iron-session'
import type { SessionData } from './types'

export type { SessionData }

/**
 * iron-session configuration used by both API route handlers and edge middleware.
 *
 * Kept in a separate file from `lib/session.ts` so it can be imported in
 * `middleware.ts` without pulling in `next/headers`, which is unavailable in
 * the Next.js edge runtime.
 *
 * `password` is a lazy getter so that the absence of SESSION_SECRET does not
 * throw at module-import time (which would break `next build`). The error is
 * raised only when an actual session operation is performed.
 */
export const sessionOptions: SessionOptions = {
  get password(): string {
    const secret = process.env.SESSION_SECRET
    if (!secret) throw new Error('SESSION_SECRET environment variable is required')
    return secret
  },
  cookieName: 'depo_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  },
}
