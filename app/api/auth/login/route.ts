import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * GET /api/auth/login — Initiates the GitHub OAuth authorisation flow.
 *
 * Generates a cryptographically-random 32-character hex CSRF state nonce,
 * stores it as a short-lived `httpOnly` `depo_oauth_state` cookie on the
 * response, and returns a `307` redirect to the GitHub OAuth authorise
 * endpoint with `client_id`, `scope`, `redirect_uri`, and `state` parameters.
 *
 * This logic lives in a Route Handler rather than the landing page Server
 * Component because Next.js only permits cookie mutation in Route Handlers
 * and Server Actions — not in Server Component render functions.
 *
 * All failure paths redirect to `/?error=auth_failed` rather than returning
 * a `4xx`/`5xx` directly, so the user always lands on a recoverable page.
 *
 * @param request - Incoming GET request. The URL is used to construct the
 *   fallback redirect target when required environment variables are absent.
 * @returns `307` redirect to the GitHub OAuth authorise URL with the
 *   `depo_oauth_state` cookie set, or a redirect to `/?error=auth_failed`
 *   when `GITHUB_CLIENT_ID` or `NEXT_PUBLIC_APP_URL` are not configured.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!clientId || !appUrl) {
    const missing = [
      !clientId && 'GITHUB_CLIENT_ID',
      !appUrl && 'NEXT_PUBLIC_APP_URL',
    ]
      .filter(Boolean)
      .join(', ')
    console.error(`[auth/login] Missing required environment variables: ${missing}`)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  const state = randomBytes(16).toString('hex')

  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('scope', 'public_repo,delete_repo')
  authUrl.searchParams.set('redirect_uri', `${appUrl}/api/auth/callback`)
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('depo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  return response
}
