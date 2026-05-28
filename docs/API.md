# API Reference

Depo exposes four serverless API routes. All routes run server-side and access the GitHub token exclusively via the encrypted session cookie — the token is never returned to the client.

---

## Authentication

Protected routes require a valid session cookie (`depo_session`). If the session is missing or the token has been revoked, the route returns `401`. Client code should redirect to `/?error=session_expired` on receiving a `401` from any protected route.

**Note on page routes vs. API routes**: requests to `/repos`, `/confirm`, and `/done` are intercepted by Next.js middleware *before* any server component runs. Unauthenticated page requests receive a `307` redirect to `/` and never invoke an API route. The `401` behaviour described below applies specifically to direct calls to `/api/repos` and `/api/delete`.

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

**Error responses**:

| Status | Condition |
|--------|-----------|
| `401` | No valid session |
| `500` | GitHub API error |

**Implementation notes**:
- Uses Octokit's `paginate` method to fetch all pages automatically (GitHub returns max 100 per page)
- Fetches only repos of type `owner` with `visibility: 'public'`, sorted by `updated` descending. `per_page: 100` is passed to minimise round trips — `octokit.paginate` accumulates all pages before returning.

---

## `POST /api/delete`

Deletes a list of repositories sequentially. Uses a 150ms delay between each deletion to respect GitHub's secondary rate limits.

**Auth required**: Yes (session cookie)

**Request body**:

```json
{
  "repos": ["repo-name-one", "repo-name-two"]
}
```

`repos` must be an array of repo name strings (not full names — owner is derived from the session). Maximum 100 items.

**Success response** (`200`):

```json
{
  "results": [
    { "repo": "repo-name-one", "status": "deleted" },
    { "repo": "repo-name-two", "status": "error", "error": "Not Found" }
  ]
}
```

Each result has `status: "deleted"` or `status: "error"`. Partial failure is not treated as a total failure — the route always returns `200` with per-repo statuses.

**Error responses**:

| Status | Condition |
|--------|-----------|
| `400` | Body missing, `repos` is not an array, array is empty, or array exceeds 100 items |
| `401` | No valid session |

**GitHub API errors** (captured per-repo as `status: "error"`):

| GitHub HTTP code | Meaning | Error message |
|-----------------|---------|---------------|
| `403` | Token lacks `delete_repo` scope | "Token lacks delete_repo scope. Please sign in again." |
| `404` | Repo not found or already deleted | "Repository not found — it may already have been deleted." |
| `422` | Cannot be deleted (e.g., last repo in an org) | GitHub's error message verbatim |
| `429` | Rate limited | "GitHub rate limit reached. Please wait a minute and try again." |

**Implementation notes**:
- Deletions are strictly **sequential** — `Promise.all` is intentionally not used
- A `150ms` delay (`DELETION_DELAY_MS`) is awaited between each deletion
- The route has a **60-second Vercel timeout** configured in `vercel.json` to accommodate large batches
- Repo names are passed to Octokit's typed `repos.delete()` method — they are not shell-interpolated

---

## `POST /api/signout`

Destroys the session cookie and redirects to the landing page.

**Auth required**: No

**Request**: No body.

**Response**: Redirects to `/`.

**Side effects**: Calls `session.destroy()`, which clears the `depo_session` cookie.
