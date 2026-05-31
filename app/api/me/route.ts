import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

/**
 * GET /api/me — Returns the authenticated user's GitHub login.
 *
 * This lightweight endpoint exists because client components (specifically
 * `app/confirm/page.tsx`) need the session login to generate CLI commands for
 * the `gh` and `curl` output modes. Client components cannot call `getSession()`
 * directly — it requires `next/headers` which is server-only — so this route
 * acts as a thin bridge.
 *
 * @returns
 *   - `200 { login: string }` — the GitHub username from the active session.
 *   - `401 { error: 'Not authenticated' }` — no valid session cookie present.
 */
export async function GET() {
  const session = await getSession()
  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return NextResponse.json({ login: session.login })
}
