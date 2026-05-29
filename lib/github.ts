import { Octokit } from '@octokit/rest'
import type { Repo } from './types'

/**
 * Creates an authenticated Octokit REST client.
 *
 * @param token - GitHub OAuth or personal access token.
 * @returns Octokit instance configured with the token as the Bearer auth credential.
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

/**
 * Fetches all public repositories owned by the authenticated user.
 *
 * Uses `octokit.paginate` to transparently accumulate every page, so a user
 * with 300 repos receives all 300 in one call. Only repos with `type: 'owner'`
 * and `visibility: 'public'` are returned, sorted by most-recently-updated descending.
 *
 * @param token - A valid GitHub OAuth access token.
 * @returns Resolved array of {@link Repo} objects across all pages.
 */
export async function listPublicRepos(token: string): Promise<Repo[]> {
  const octokit = createOctokit(token)
  const raw = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    type: 'owner',
    visibility: 'public',
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
  })
  return raw.map(r => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description ?? null,
    fork: r.fork,
    stargazerCount: r.stargazers_count ?? 0,
    updatedAt: r.updated_at ?? null,
    url: r.html_url,
    visibility: r.visibility as 'public' | 'private',
  }))
}

/**
 * Deletes a single GitHub repository via the REST API.
 *
 * Requires the access token to have the `delete_repo` scope. Throws an
 * Octokit `HttpError` on 403 (insufficient scope), 404 (not found),
 * or 429 (secondary rate limit reached).
 *
 * @param token - A valid GitHub OAuth access token with `delete_repo` scope.
 * @param owner - The repository owner's GitHub login.
 * @param repo - Short repository name (not the full `owner/repo` form).
 */
export async function deleteRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const octokit = createOctokit(token)
  await octokit.repos.delete({ owner, repo })
}
