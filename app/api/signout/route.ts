import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

/**
 * POST /api/signout — Destroys the session cookie and redirects to the landing page.
 *
 * Calls `session.destroy()` which instructs iron-session to overwrite the
 * `depo_session` cookie with an expired, empty value, effectively signing the
 * user out. The GitHub access token stored in the cookie becomes inaccessible.
 *
 * No authentication check is performed — calling signout while already signed
 * out is a safe no-op: `destroy()` on an empty session is harmless.
 *
 * The redirect target is the absolute root URL derived from `NEXT_PUBLIC_APP_URL`
 * rather than a relative path, ensuring the redirect works correctly in both
 * local development and production deployments behind different base URLs.
 *
 * @returns A `307` redirect to `NEXT_PUBLIC_APP_URL + '/'`.
 */
export async function POST() {
  const session = await getSession()
  session.destroy()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!))
}
