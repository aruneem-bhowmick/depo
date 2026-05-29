import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions } from './sessionOptions'
import type { SessionData } from './types'

/**
 * Reads and decrypts the `depo_session` cookie from the current server request.
 *
 * Wraps `getIronSession` with the project's shared session options. Must only
 * be called from server-side contexts (API route handlers, server components)
 * because it depends on `next/headers`. Edge middleware must instead use
 * `sessionOptions` from `lib/sessionOptions` with the
 * `getIronSession(request, response, options)` overload directly.
 *
 * @returns Decrypted {@link SessionData} for the current user, or an empty
 *   session object if no valid `depo_session` cookie is present.
 */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
