# API Reference

Depo exposes four serverless API routes. All routes run server-side and access the GitHub token exclusively via the encrypted session cookie — the token is never returned to the client.

---

## Authentication

Protected routes require a valid session cookie (`depo_session`). If the session is missing or the token has been revoked, the route returns `401`. Client code should redirect to `/?error=session_expired` on receiving a `401` from any protected route.

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

| Condition | Behavior |
|-----------|----------|
| `state` mismatch | Returns `400 Bad Request` |
| GitHub token exchange fails | Redirects to `/?error=auth_failed` |
| GitHub `access_token` missing in response | Redirects to `/?error=auth_failed` |

**Side effects**:
- Writes `{ accessToken, login, avatarUrl }` to the `depo_session` cookie
- Deletes the `depo_oauth_state` cookie

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
- Fetches only repos of type `owner` with `visibility: 'public'`

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
