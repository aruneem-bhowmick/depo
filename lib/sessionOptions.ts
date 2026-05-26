import type { SessionOptions } from 'iron-session'
import type { SessionData } from './types'

export type { SessionData }

const secret = process.env.SESSION_SECRET
if (!secret) {
  throw new Error('SESSION_SECRET environment variable is required')
}

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
