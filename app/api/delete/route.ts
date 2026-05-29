import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { deleteRepo } from '@/lib/github'
import { DELETION_DELAY_MS, MAX_BATCH_SIZE } from '@/lib/constants'
import type { DeletionResult } from '@/lib/types'

/**
 * Resolves after `ms` milliseconds.
 *
 * Used to insert a mandatory pause between sequential GitHub deletion calls so
 * that Depo stays within GitHub's secondary rate limits for destructive
 * operations.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Translates a raw GitHub / Octokit error message into a user-readable string.
 *
 * Only the HTTP status codes that have meaningful, actionable meanings for the
 * delete operation are mapped. Everything else passes through verbatim so the
 * raw message is still available for debugging.
 *
 * @param message - The `.message` from the caught Error object.
 * @returns A user-facing error string suitable for display in the UI.
 */
function mapGitHubError(message: string): string {
  if (message.includes('403')) return 'Token lacks delete_repo scope. Please sign in again.'
  if (message.includes('404')) return 'Repository not found — it may already have been deleted.'
  if (message.includes('422')) return `Cannot delete: ${message}`
  if (message.includes('429')) return 'GitHub rate limit reached. Please wait a minute and try again.'
  return message
}

/**
 * POST /api/delete — Sequentially deletes a list of the authenticated user's
 * public repositories.
 *
 * Deletions are performed one at a time with a mandatory {@link DELETION_DELAY_MS}
 * pause between each call. `Promise.all` is intentionally **not** used: GitHub's
 * secondary rate limits penalise concurrent destructive requests. Each deletion
 * is attempted independently — a failure for one repo does not abort the
 * remaining repos.
 *
 * **Request body**: `{ repos: string[] }` — array of short repo names (not
 * full `owner/repo` names). The owner is derived from the session login.
 * Maximum {@link MAX_BATCH_SIZE} items.
 *
 * @returns
 *   - `200 { results: DeletionResult[] }` — always returned on completion,
 *     even when individual repos fail. Inspect each result's `status` field.
 *   - `400 { error: string }` — body missing, malformed, `repos` not an array,
 *     empty array, exceeds `MAX_BATCH_SIZE`, or contains entries that are not
 *     non-empty short repo names (e.g. empty strings or `owner/repo` values).
 *   - `401 { error: 'Not authenticated' }` — no valid session cookie.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as Record<string, unknown>).repos)
  ) {
    return NextResponse.json({ error: 'Body must be { repos: string[] }' }, { status: 400 })
  }

  const repos = (body as { repos: unknown[] }).repos

  if (repos.length === 0) {
    return NextResponse.json({ error: 'repos array must not be empty' }, { status: 400 })
  }

  if (repos.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Cannot delete more than ${MAX_BATCH_SIZE} repos at once` },
      { status: 400 },
    )
  }

  if (!repos.every(r => typeof r === 'string' && r.trim().length > 0 && !r.includes('/'))) {
    return NextResponse.json(
      { error: 'All entries in repos must be non-empty short repo names (no owner/ prefix)' },
      { status: 400 },
    )
  }

  const repoNames = repos as string[]
  const results: DeletionResult[] = []

  for (let i = 0; i < repoNames.length; i++) {
    const repo = repoNames[i]
    try {
      await deleteRepo(session.accessToken, session.login, repo)
      results.push({ repo, status: 'deleted' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ repo, status: 'error', error: mapGitHubError(message) })
    }

    // Mandatory pause between deletions to stay within GitHub's secondary rate
    // limits. Skipped after the last item to avoid an unnecessary wait at the end.
    if (i < repoNames.length - 1) {
      await delay(DELETION_DELAY_MS)
    }
  }

  return NextResponse.json({ results })
}
