import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { listPublicRepos } from '@/lib/github'

/**
 * GET /api/repos — Returns the authenticated user's public GitHub repositories.
 *
 * Reads the access token from the encrypted `depo_session` cookie and delegates
 * to {@link listPublicRepos}, which uses Octokit's `paginate` to fetch every
 * page automatically. The token is never included in the response body.
 *
 * @returns
 *   - `200` with a `Repo[]` JSON array (empty array when the user has no public repos)
 *   - `401 { error: 'Not authenticated' }` when no session cookie is present
 *   - `401 { error: 'Session expired. Please sign in again.' }` when GitHub rejects the
 *     token (revoked after the session was created)
 *   - `500 { error: 'GitHub API error: <message>' }` for any other GitHub API failure
 */
export async function GET() {
  const session = await getSession()

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const repos = await listPublicRepos(session.accessToken)
    return NextResponse.json(repos)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('401') || message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: `GitHub API error: ${message}` },
      { status: 500 },
    )
  }
}
