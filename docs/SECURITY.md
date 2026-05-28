# Security

Depo is a destructive-action tool — it holds a `delete_repo`-scoped GitHub token and can permanently remove repositories. This document explains the security decisions made to protect that token and the user's account.

---

## Token Storage

The GitHub OAuth access token is stored exclusively in an `iron-session` encrypted HTTP-only cookie (`depo_session`).

- **Never returned to the client**: the `/api/repos` and `/api/delete` routes use the token server-side only. It does not appear in any API response body or client-side JavaScript bundle.
- **HTTP-only**: the cookie is inaccessible to JavaScript running in the browser (`document.cookie`, `localStorage`, etc.) — it can only be sent by the browser on HTTP requests.
- **`secure: true` in production**: the cookie is only transmitted over HTTPS when `NODE_ENV === 'production'`.
- **`sameSite: 'lax'`**: prevents the cookie from being sent on cross-site requests initiated from third-party pages (protects against CSRF on the API routes themselves).
- **8-hour expiry**: the session expires automatically. Users will need to re-authenticate after 8 hours of inactivity.

---

## SESSION_SECRET Startup Validation

`lib/sessionOptions.ts` reads `process.env.SESSION_SECRET` at **module load time** — outside any function, at the top level of the module. If the variable is absent or empty, the module throws immediately:

```
Error: SESSION_SECRET environment variable is required
```

A deployment that starts without `SESSION_SECRET` set will crash before serving any requests. It cannot silently fall back to an empty or predictable encryption password that would make all session cookies trivially forgeable. This is a defense-in-depth measure: even if infrastructure configuration is incorrect, the application refuses to run in a broken security state.

---

## CSRF Protection on OAuth Callback

The OAuth flow uses a state parameter to prevent [CSRF attacks on the authorization callback](https://datatracker.ietf.org/doc/html/rfc6749#section-10.12):

1. Before redirecting to GitHub, the landing page generates a random nonce and stores it in a short-lived `depo_oauth_state` cookie.
2. The nonce is also passed as the `state` query parameter in the GitHub OAuth authorize URL.
3. When GitHub redirects back to `/api/auth/callback`, the route reads `state` from the query string and compares it to the `depo_oauth_state` cookie. This check runs **before any network call** — the token exchange is never attempted if the state is invalid.
4. If the values are missing or don't match, the callback redirects to `/?error=auth_failed` and discards the code — no token exchange occurs.
5. On successful validation and session write, the `depo_oauth_state` cookie is deleted via a `Set-Cookie` header on the redirect response to `/repos`.

This ensures that only the browser that initiated the sign-in flow can complete it.

---

## Protected Route Middleware

Next.js middleware (`middleware.ts`) enforces authentication at the routing layer, before any server component or API route handler executes on the protected paths.

- **Protected paths**: `/repos`, `/confirm`, `/done` and all sub-paths. Any request to these routes without a valid `depo_session` cookie containing an `accessToken` is redirected to `/` with a `307`.
- **Corrupted cookie handling**: if the `depo_session` cookie exists but cannot be decrypted (tampered, truncated, or encrypted with a different secret), the middleware catches the `getIronSession` error and redirects to `/` rather than propagating the exception. This prevents a malformed cookie from reaching protected page logic.
- **Defense in depth**: the middleware redirect is a first-line guard. API routes (`/api/repos`, `/api/delete`) independently validate the session and return `401` for unauthenticated or revoked tokens.

---

## Scope Minimization

Depo requests the minimum GitHub OAuth scopes required:

| Scope | Why it's needed |
|-------|----------------|
| `public_repo` | Grants read access to public repo metadata (names, descriptions, etc.) and is required to list them |
| `delete_repo` | Grants deletion rights — required for the core functionality |

The `repo` scope (which grants full access to private repositories) is **not requested**. Depo only operates on public repositories in v1.

---

## Input Validation on the Delete Route

The `POST /api/delete` body is validated before any GitHub API calls are made:

- `repos` must be present and be an array
- The array must be non-empty
- The array must not exceed `MAX_BATCH_SIZE` (100) items
- Each item must be a string

Repo names are passed directly to Octokit's typed `repos.delete({ owner, repo })` method — they are never interpolated into shell commands or SQL queries server-side. Octokit handles URL-encoding.

---

## Rate Limiting Strategy

GitHub enforces secondary rate limits on destructive operations. Two measures protect against hitting them:

1. **150ms inter-deletion delay** (`DELETION_DELAY_MS`): a `setTimeout` pause between each sequential `repos.delete` call. This is a hard-coded safety measure, not a tuning parameter.
2. **`MAX_BATCH_SIZE` cap of 100**: prevents a single session from deleting more than 100 repositories in one request. This both limits blast radius and prevents the delete route from running long enough to trigger rate limits.

Deletions are strictly sequential — `Promise.all` is explicitly avoided. GitHub's secondary rate limits apply per unit of time, and concurrent destructive requests are far more likely to trigger them than sequential ones.

---

## Session Expiry and Token Revocation

If a session expires or the user revokes Depo's OAuth access on GitHub:

- Any subsequent GitHub API call will receive a `401` from GitHub
- API routes catch this and return `401` to the client
- The client redirects to `/?error=session_expired`
- The landing page detects this query parameter and displays: "Your session expired. Please sign in again."

Users can also revoke access at any time via **GitHub → Settings → Applications → Authorized OAuth Apps**.
