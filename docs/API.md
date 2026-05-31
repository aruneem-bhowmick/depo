# API Reference

Depo exposes six serverless API routes. All routes run server-side and access the GitHub token exclusively via the encrypted session cookie — the token is never returned to the client.

---

## Authentication

Protected routes require a valid session cookie (`depo_session`). If the session is missing or the token has been revoked, the route returns `401`. Client code should redirect to `/?error=session_expired` on receiving a `401` from any protected route.

**Note on page routes vs. API routes**: requests to `/repos`, `/confirm`, and `/done` are intercepted by Next.js middleware *before* any server component runs. Unauthenticated page requests receive a `307` redirect to `/` and never invoke an API route. The `401` behaviour described below applies specifically to direct calls to `/api/repos` and `/api/delete`.

---

## `GET /api/auth/login`

Initiates the GitHub OAuth authorisation flow. Generates a CSRF state nonce, stores it as a short-lived `httpOnly` cookie, and redirects the browser to the GitHub OAuth authorize endpoint.

**Auth required**: No

**Request**: No body or query parameters.

**Success response**: `307` redirect to `https://github.com/login/oauth/authorize` with query parameters:

| Parameter | Value |
|-----------|-------|
| `client_id` | `GITHUB_CLIENT_ID` environment variable |
| `scope` | `public_repo,delete_repo` |
| `redirect_uri` | `NEXT_PUBLIC_APP_URL + /api/auth/callback` |
| `state` | 32-character hex CSRF nonce from `crypto.randomBytes(16)` |

**Side effects**: Sets a `depo_oauth_state` cookie on the redirect response with `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (production only), `maxAge: 600` (10 minutes), `path: '/'`.

**Failure response**: `307` redirect to `/?error=auth_failed` (with a `console.error` log) when `GITHUB_CLIENT_ID` or `NEXT_PUBLIC_APP_URL` are absent. The route never returns `4xx`/`5xx` directly.

**Implementation notes**:
- This Route Handler exists specifically because Next.js only permits cookie mutation in Route Handlers and Server Actions — not during Server Component render. The landing page links to `/api/auth/login` instead of directly to GitHub for this reason.
- Only `GET` is exported — other HTTP methods return `405 Method Not Allowed`.

---

## `GET /api/auth/callback`

Handles the GitHub OAuth redirect. Exchanges the authorization code for an access token, fetches the user's profile, and sets the session cookie.

**Auth required**: No

**Query parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | `string` | Authorization code from GitHub |
| `state` | `string` | CSRF nonce — must match the `depo_oauth_state` cookie |

**Success**: Redirects to `/repos` with the session cookie set.

**Failure responses**:

All failure paths redirect to `/?error=auth_failed` — the route never returns a `4xx` or `5xx` directly. The CSRF state check runs before any network call; if it fails, no token exchange is attempted.

| Condition | Behavior |
|-----------|----------|
| `state` param missing or does not match `depo_oauth_state` cookie | Redirects to `/?error=auth_failed` |
| `code` param missing | Redirects to `/?error=auth_failed` |
| `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` env vars absent | Redirects to `/?error=auth_failed` |
| Token exchange fetch throws (DNS failure, timeout, connection reset) | Redirects to `/?error=auth_failed` |
| GitHub token exchange returns an `error` field (e.g. `bad_verification_code`) | Redirects to `/?error=auth_failed` |
| GitHub token exchange returns no `access_token` | Redirects to `/?error=auth_failed` |
| GitHub user profile fetch throws a network error | Redirects to `/?error=auth_failed` |
| GitHub user profile fetch returns a non-OK status | Redirects to `/?error=auth_failed` |
| User profile response missing or non-string `login` field | Redirects to `/?error=auth_failed` |
| Session save fails (encryption or I/O error) | Redirects to `/?error=auth_failed` |

**Side effects**:
- Writes `{ accessToken, login, avatarUrl }` to the `depo_session` cookie (`avatar_url` defaults to `''` if absent from the GitHub response)
- Deletes the `depo_oauth_state` cookie via `Set-Cookie: depo_oauth_state=; Expires=<epoch>` on the redirect response

**Implementation notes**:
- The token exchange POST must include `Accept: application/json`; without it GitHub returns URL-encoded form data instead of JSON.
- The user profile fetch uses the `Bearer` authorization scheme (the `token` scheme is deprecated by GitHub).
- All three outbound network operations (token exchange, user profile fetch, session save) are wrapped in independent try/catch blocks. Unhandled exceptions in any of them redirect to `/?error=auth_failed` rather than crashing the route with an unhandled 500.

---

## `GET /api/repos`

Returns the authenticated user's public repositories, sorted by most recently updated.

**Auth required**: Yes (session cookie)

**Request**: No body or query parameters.

**Success response** (`200`):

```json
[
  {
    "id": 123456789,
    "name": "my-project",
    "fullName": "username/my-project",
    "description": "A short description or null",
    "fork": false,
    "stargazerCount": 4,
    "updatedAt": "2024-11-15T10:23:00Z",
    "url": "https://github.com/username/my-project",
    "visibility": "public"
  }
]
```

The response is a bare JSON array (not wrapped in an object). An empty array `[]` is a valid successful response when the user has no public repos.

**Error responses**:

| Status | Body `error` field | Condition |
|--------|-------------------|-----------|
| `401` | `"Not authenticated"` | Session cookie is absent or has no `accessToken` |
| `401` | `"Session expired. Please sign in again."` | GitHub returned `401` — token was revoked after the session was created |
| `500` | `"GitHub API error: <message>"` | Any other error from the GitHub API |

**Client handling**:
- On `401`, redirect to `/?error=session_expired` so the user can re-authenticate.
- On `500`, display the `error` field to the user. These errors are transient (rate limits, GitHub outages) and the user can retry.

**Implementation notes**:
- Delegates entirely to `listPublicRepos(token)` in `lib/github.ts` — no Octokit instantiation in the route itself.
- Uses Octokit's `paginate` method to fetch all pages automatically; a user with 300 repos receives all 300 in a single response.
- Query parameters sent to GitHub: `{ type: 'owner', visibility: 'public', sort: 'updated', direction: 'desc', per_page: 100 }`. The `type: 'owner'` filter excludes repos the user collaborates on but does not own.
- Distinguishes revoked-token errors from other GitHub errors by checking whether the error message contains `'401'` or `'Unauthorized'`. A revoked token returns `401` to the client so the page can prompt re-authentication rather than showing a generic server error.
- The GitHub access token is read exclusively from the server-side session cookie and is never echoed in the response.

---

## `POST /api/delete`

Deletes a list of repositories sequentially. Uses a mandatory 150ms delay between each deletion to respect GitHub's secondary rate limits.

**Auth required**: Yes (session cookie)

**Request body**:

```json
{
  "repos": ["repo-name-one", "repo-name-two"]
}
```

`repos` must be an array of **short repo name strings** (e.g. `"my-project"`, not `"username/my-project"`). The owner is derived from the session login — never parse or pass it in the request. Maximum 100 items per request.

**Success response** (`200`):

```json
{
  "results": [
    { "repo": "repo-name-one", "status": "deleted" },
    { "repo": "repo-name-two", "status": "error", "error": "Repository not found — it may already have been deleted." }
  ]
}
```

The response is always wrapped in a `{ results: DeletionResult[] }` object — never a bare array. Each entry in `results` has:

| Field | Type | Description |
|-------|------|-------------|
| `repo` | `string` | Short repo name (matches the input) |
| `status` | `"deleted" \| "error"` | Outcome for this repo |
| `error` | `string` (optional) | Present only when `status === "error"` |

Partial failure is not treated as a total failure — all repos in the batch are attempted. The route always returns `200` with per-repo statuses when the batch itself is valid.

**Request validation errors** (`400`):

| Condition | Error message |
|-----------|--------------|
| Body is not valid JSON | `"Invalid JSON body"` |
| Body is not an object or `repos` key is missing | `"Body must be { repos: string[] }"` |
| `repos` array is empty | `"repos array must not be empty"` |
| `repos` array exceeds 100 items | `"Cannot delete more than 100 repos at once"` |
| Any entry in `repos` is not a string | `"All entries in repos must be strings"` |

**Authentication error** (`401`):

| Body `error` field | Condition |
|-------------------|-----------|
| `"Not authenticated"` | Session cookie is absent or has no `accessToken` |

**Per-repo GitHub API errors** (returned as `status: "error"` entries within the `200` results array):

| GitHub HTTP code | Meaning | `error` field value |
|-----------------|---------|---------------------|
| `403` | Token lacks `delete_repo` scope | `"Token lacks delete_repo scope. Please sign in again."` |
| `404` | Repo not found or already deleted | `"Repository not found — it may already have been deleted."` |
| `422` | Cannot be deleted (e.g. last repo in an org) | `"Cannot delete: <GitHub error message>"` |
| `429` | Secondary rate limit hit | `"GitHub rate limit reached. Please wait a minute and try again."` |
| Other | Unexpected error | Raw error message from GitHub/Octokit |

**Implementation notes**:
- Deletions are strictly **sequential** — `Promise.all` is intentionally not used. GitHub's secondary rate limits penalise concurrent destructive requests.
- A `150ms` pause (`DELETION_DELAY_MS` from `lib/constants.ts`) is awaited between each deletion. The pause is skipped after the final item.
- The route has a **60-second Vercel timeout** configured in `vercel.json` to accommodate large batches (100 repos × 150ms ≈ 15 seconds plus GitHub round-trip latency).
- The owner parameter for every GitHub API call is sourced exclusively from `session.login` — it is never parsed from the repo name or the request body.
- Repo names are passed to Octokit's typed `repos.delete({ owner, repo })` method — they are never interpolated into shell commands or URL strings by the route handler.
- A failure for one repo does not abort the remaining repos; all are attempted and all outcomes are reported.

---

## `GET /api/me`

Returns the authenticated user's GitHub login name. This lightweight endpoint exists for client components that need the session login (e.g., to generate CLI deletion commands) but cannot call `getSession()` directly because `next/headers` is server-only.

**Auth required**: Yes (session cookie)

**Request**: No body or query parameters.

**Success response** (`200`):

```json
{ "login": "username" }
```

**Error responses**:

| Status | Body `error` field | Condition |
|--------|-------------------|-----------|
| `401` | `"Not authenticated"` | Session cookie is absent or has no `accessToken` |

**Implementation notes**:
- Only `GET` is exported — other HTTP methods return `405 Method Not Allowed`.
- The route reads `session.login` from the encrypted cookie and returns it as-is. No GitHub API call is made.
- The access token is never included in the response.

---

## `POST /api/signout`

Destroys the session cookie and redirects to the landing page.

**Auth required**: No — calling signout while already signed out is a safe no-op.

**Request**: No body or query parameters.

**Response**: `307` redirect to `NEXT_PUBLIC_APP_URL + '/'`. Falls back to the origin of the incoming request URL if `NEXT_PUBLIC_APP_URL` is absent or not a valid URL string.

**Side effects**:

- Calls `session.destroy()`, which overwrites the `depo_session` cookie with an expired, empty value. The GitHub access token stored in the cookie is no longer accessible after this call.

**Error responses**: None. The route does not validate the session before destroying it. An unauthenticated call (no session cookie, or a corrupted cookie) completes without error and redirects to `/`.

**Implementation notes**:

- `session.destroy()` is synchronous in iron-session v8 — it is **not** awaited.
- The redirect target is constructed via `new URL('/', process.env.NEXT_PUBLIC_APP_URL)`. If that env var is absent or malformed, the `URL` constructor throws a `TypeError`; the route catches this and derives the root from `request.url` instead. `NextResponse.redirect()` in Next.js 14 requires an absolute URL and rejects relative paths, so both code paths always produce a fully-qualified target.
- Only `POST` is exported — a browser `GET` to `/api/signout` returns `405 Method Not Allowed` (Next.js default). The `SignOutButton` component calls this route via `fetch('/api/signout', { method: 'POST' })`, not via a form submission or anchor link.
