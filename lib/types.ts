/**
 * Represents a GitHub repository returned by the /api/repos endpoint.
 * Maps the raw Octokit response shape to Depo's internal type.
 */
export interface Repo {
  /** Internal GitHub repository ID. */
  id: number
  /** Short repository name, e.g. "my-project". Never contains a slash. */
  name: string
  /** Full owner/repo name, e.g. "username/my-project". */
  fullName: string
  /** Repository description, or null when none is set on GitHub. */
  description: string | null
  /** Whether this repository is a fork of another. */
  fork: boolean
  /** Number of GitHub stars. */
  stargazerCount: number
  /** ISO 8601 timestamp of the last push, or null if the repo has never been pushed to. */
  updatedAt: string | null
  /** GitHub web URL, e.g. "https://github.com/username/my-project". */
  url: string
  /** Repository visibility as reported by the GitHub API. */
  visibility: 'public' | 'private'
}

/**
 * The per-repository outcome included in the response from POST /api/delete.
 */
export interface DeletionResult {
  /** Short repository name (matches Repo.name — never the full owner/repo form). */
  repo: string
  /** Whether the deletion succeeded or encountered an error. */
  status: 'deleted' | 'error'
  /** Human-readable description of the failure; present only when status is 'error'. */
  error?: string
}

/**
 * The payload stored in the encrypted iron-session cookie (`depo_session`).
 * All three fields are required; the cookie is written only after a successful OAuth flow.
 */
export interface SessionData {
  /** GitHub OAuth access token. Never returned in API responses or client-side code. */
  accessToken: string
  /** Authenticated user's GitHub username. */
  login: string
  /** URL of the user's GitHub avatar image. */
  avatarUrl: string
}
