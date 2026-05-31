import { getSession } from '@/lib/session'
import { listPublicRepos } from '@/lib/github'
import { RepoList } from '@/components/RepoList'
import type { Repo } from '@/lib/types'

/**
 * Repo list page — async server component for the `/repos` route.
 *
 * Fetches the authenticated user's public repositories by calling
 * {@link listPublicRepos} directly (not via `fetch('/api/repos')`). Calling
 * the library function directly avoids an unnecessary HTTP round-trip to the
 * same process. The Next.js middleware guarantees that `session.accessToken`
 * is present before this component runs, so no manual auth check is needed
 * here; however, the token may have been revoked server-side since the session
 * was created, in which case `listPublicRepos` will throw.
 *
 * **Success path**: repos are passed as props to the `<RepoList>` client
 * component, which owns all interactive state (selection set, search query,
 * fork-visibility toggle).
 *
 * **Empty repos path**: `<RepoList repos={[]} />` is rendered; the component
 * shows an "No repositories to show." empty state.
 *
 * **Error path**: an inline `role="alert"` box containing the error message is
 * shown, along with a "Try again" anchor to `/repos` that re-triggers the
 * server-side fetch on navigation. The caught error is also logged server-side
 * via `console.error` with structured context (session login, error object) so
 * that failures such as revoked tokens or GitHub rate limits are visible in
 * server logs without exposing the raw access token.
 */
export default async function ReposPage() {
  const session = await getSession()

  let repos: Repo[] = []
  let fetchError: string | null = null

  try {
    repos = await listPublicRepos(session.accessToken)
  } catch (err: unknown) {
    console.error('[ReposPage] listPublicRepos failed', {
      login: session.login,
      error: err,
    })
    fetchError = err instanceof Error ? err.message : 'Failed to load repositories.'
  }

  if (fetchError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Your repositories</h1>
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {fetchError}
        </div>
        <a
          href="/repos"
          className="text-sm text-violet-600 hover:underline w-fit focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          Try again
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Your repositories</h1>
      <RepoList repos={repos} />
    </div>
  )
}
