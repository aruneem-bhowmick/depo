import { NextRequest, NextResponse } from 'next/server'
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
 * The redirect target is built from `NEXT_PUBLIC_APP_URL` when that variable is
 * present and contains a valid URL. If it is absent or malformed, the route falls
 * back to deriving the root from the incoming `request.url`, which is always an
 * absolute URL and therefore always a valid base. `NextResponse.redirect()` in
 * Next.js 14 requires an absolute URL and rejects relative paths, so both paths
 * through this function always produce an absolute target.
 *
 * @param request - The incoming POST request; used as the base URL fallback.
 * @returns A `307` redirect to `NEXT_PUBLIC_APP_URL + '/'`, or to the origin of
 *   the request URL when that env var is absent or invalid.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  session.destroy()
  let target: string
  try {
    target = new URL('/', process.env.NEXT_PUBLIC_APP_URL).toString()
  } catch {
    target = new URL('/', request.url).toString()
  }
  return NextResponse.redirect(target)
}
