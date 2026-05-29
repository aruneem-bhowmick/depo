import type { SessionOptions } from 'iron-session'
import type { SessionData } from './types'

export type { SessionData }

const secret = process.env.SESSION_SECRET
if (!secret) {
  throw new Error('SESSION_SECRET environment variable is required')
}

/**
 * iron-session configuration used by both API route handlers and edge middleware.
 *
 * Kept in a separate file from `lib/session.ts` so it can be imported in
 * `middleware.ts` without pulling in `next/headers`, which is unavailable in
 * the Next.js edge runtime.
 */
export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: 'depo_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  },
}
