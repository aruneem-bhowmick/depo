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

The OAuth flow uses the `state` parameter (required by [RFC 6749 §10.12](https://datatracker.ietf.org/doc/html/rfc6749#section-10.12)) to prevent cross-site request forgery on the authorization callback.

### Mechanism

1. When the landing page (`app/page.tsx`) is served to an unauthenticated visitor, it generates a 16-byte cryptographically random nonce using Node.js `crypto.randomBytes(16)` and encodes it as a 32-character hex string.
2. The nonce is written server-side to a `depo_oauth_state` cookie with these attributes: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (production only), `maxAge: 600` (10 minutes), `path: '/'`.
3. The same nonce is embedded as the `state` query parameter in the GitHub OAuth authorize URL rendered in the sign-in link.
4. When the user clicks "Sign in with GitHub", the browser navigates to GitHub carrying both the cookie and the `state` in the URL. GitHub appends `state` to its callback redirect unchanged.
5. `GET /api/auth/callback` reads `state` from the query string and compares it to `cookies().get('depo_oauth_state')`. This check runs **before any network call** to GitHub.
6. If the values are absent or do not match, the route redirects to `/?error=auth_failed`. No token exchange is attempted.
7. On successful validation and session write, the `depo_oauth_state` cookie is explicitly deleted by setting it on the redirect response to `/repos`.

### Security properties

- **Server-generated nonce**: `randomBytes(16)` is cryptographically unpredictable. An attacker cannot pre-compute or guess a valid nonce.
- **httpOnly storage**: The nonce cookie is inaccessible to browser JavaScript (`document.cookie`). XSS cannot steal the nonce to forge a valid callback request.
- **Short expiry**: The 10-minute `maxAge` limits the window during which a leaked nonce could be exploited.
- **Immediate deletion on success**: The nonce is single-use; the cookie is deleted as soon as it is validated, preventing replay.

This design ensures that only the browser instance that rendered the landing page can complete the OAuth flow for that particular sign-in attempt.

---

## Network-Layer Resilience in the OAuth Callback

Beyond CSRF and response-content validation, the callback route is hardened against infrastructure-level failures that could otherwise crash the serverless function:

- **Missing OAuth app credentials**: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are validated at request time. If either is absent (misconfigured deployment), the route redirects to `/?error=auth_failed` immediately with a server-side `console.error` for observability — it does not silently pass `undefined` to the token exchange body.
- **Token exchange network failure**: the `fetch` call to GitHub's token endpoint is wrapped in a try/catch. DNS failures, connection resets, and timeouts are caught and redirected rather than propagated as unhandled exceptions.
- **User profile fetch network failure**: the `fetch` call to `api.github.com/user` is independently wrapped. A transient failure here also redirects safely.
- **Profile field validation**: after parsing the user profile JSON, the `login` field is checked for presence and string type before being written to the session. A malformed or unexpected API response does not silently produce a session with an undefined or empty login.
- **Session save failure**: the `iron-session` save call is wrapped in a try/catch. Although unlikely, an encryption or I/O error during session serialisation is caught and redirected rather than crashing the route.

Every failure path, at every layer, redirects to `/?error=auth_failed`. The route never returns a `4xx` or `5xx` directly, ensuring the user always lands on the landing page where an error message can be displayed.

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

---

## Landing Page Error Display

The landing page (`app/page.tsx`) is the designated recovery point for all failure paths in the OAuth flow. All API routes and the OAuth callback redirect to `/` (with an `?error=` query parameter) rather than returning `4xx`/`5xx` responses directly, so users always land on a page that can display a meaningful recovery message.

**Recognised error codes**:

| `?error=` | Trigger | Message shown |
|-----------|---------|--------------|
| `auth_failed` | CSRF mismatch, bad code, token exchange failure, missing env vars, user profile fetch failure, session save failure | "Sign-in failed. Please try again." |
| `session_expired` | GitHub returns `401` on a subsequent API call (expired or revoked token) | "Your session expired. Please sign in again." |

**Unknown error values** (e.g. a manually crafted URL) produce no alert — the `ERROR_MESSAGES` map returns `undefined` for unrecognised keys, which the component treats as `null` and renders nothing. This prevents reflected error text from being used as a vector to display arbitrary content in the UI.

**No PII in error codes**: the `?error=` parameter contains only a short, fixed string. No GitHub error messages, HTTP status codes, or internal details are reflected into the URL or the displayed message.
