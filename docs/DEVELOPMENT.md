# Development

---

## Running the App

```bash
npm run dev      # start Next.js dev server at http://localhost:3000
npm run build    # production build
npm start        # serve production build locally
```

---

## Testing

### Unit and Integration Tests (Jest)

```bash
npm test                  # run all Jest tests once
npm test -- --watch       # watch mode
npm test -- --coverage    # generate coverage report
```

**Test layout**:

```
tests/
├── unit/
│   ├── config.test.ts          next.config.ts image domain validation
│   ├── constants.test.ts       constants values and key uniqueness
│   ├── generateCommand.test.ts gh and curl command generation (14 cases)
│   ├── github.test.ts          createOctokit, listPublicRepos, deleteRepo
│   ├── session.test.ts         getSession() helper
│   ├── sessionOptions.test.ts  cookie config properties
│   ├── smoke.test.ts           basic sanity checks
│   ├── tailwindConfig.test.ts  darkMode strategy, shake keyframes and animation shorthand (7 cases)
│   ├── types.test.ts           Repo / DeletionResult / SessionData conformance
│   └── vercelJson.test.ts      vercel.json maxDuration for delete route
├── integration/
│   ├── middleware.test.ts       auth redirect behavior (14 cases)
│   ├── authCallback.test.ts    OAuth callback: CSRF validation, env vars, network errors, token exchange, session write (9 cases)
│   ├── apiRepos.test.ts        GET /api/repos: unauthenticated, empty list, repo array, revoked-token 401, GitHub 500 (6 cases)
│   ├── apiDelete.test.ts       POST /api/delete: auth, validation, sequential deletion, partial failure, error mapping (13 cases)
│   └── apiSignout.test.ts      POST /api/signout: session.destroy() call, redirect to /, no-op on empty session, NEXT_PUBLIC_APP_URL fallback (5 cases)
└── components/
    ├── Layout.test.tsx          Nav bar structure: wordmark link, authenticated user section, unauthenticated state (8 cases)
    ├── LandingPage.test.tsx     Landing page: headline, OAuth link target, error alerts, authenticated redirect (7 cases)
    ├── RepoList.test.tsx        RepoList: fork toggle, search filter, keyboard selection, combined filters, row element rendering, relativeTime NaN guard, select-all edge cases, Continue flow (24 cases)
    └── SignOutButton.test.tsx   Render, click handler, success navigation, non-2xx error path, network error path (15 cases)
```

**Jest configuration**: `config/jest.config.ts` — rootDir `../`, jsdom environment, ts-jest transform, setup file at `config/jest.setup.ts` (imports `@testing-library/jest-dom`).

**Integration tests** (`tests/integration/`) test cross-cutting behaviour that requires module interaction. No test spins up an HTTP server — they drive route/middleware handlers directly with `NextRequest` objects (or no argument for routes that take none). All integration tests use a `@jest-environment node` docblock because Next.js server-side APIs require Node globals rather than jsdom.

`middleware.test.ts` mocks `iron-session` at the module boundary and drives `middleware()` directly. The suite covers: authenticated access (no redirect), unauthenticated access (redirect to `/`), corrupted-cookie error path (redirect to `/`), and path-matching precision (e.g., confirming `/repos-test` is not intercepted).

`authCallback.test.ts` mocks `@/lib/session` and `next/headers` before imports (preventing the `SESSION_SECRET` startup guard in `sessionOptions.ts` from running), and replaces `global.fetch` with a Jest mock for controlled token exchange and user profile responses. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are stubbed in `beforeEach` and cleaned up in `afterEach` so tests that reach the token exchange path are not blocked by the env var guard. The suite covers: all CSRF failure paths (missing/mismatched state, missing code), the env var guard, token exchange network failure (fetch throws), token exchange response failures (error field, missing access_token), user profile fetch returning a non-OK status, and the full success path — session fields (`accessToken`, `login`, `avatarUrl`) written correctly, redirect to `/repos`, `depo_oauth_state` cookie deleted (verified via the `Set-Cookie` response header).

`apiRepos.test.ts` mocks `@/lib/session` and `@/lib/github` at the module boundary and calls `GET()` directly. The suite covers: the `401` response when no `accessToken` is present in the session; the `200` response with a correctly shaped `Repo[]` array; that `listPublicRepos` receives exactly the `accessToken` from the session; the `401 Session expired` response when GitHub returns a `401` (revoked token); the `500 GitHub API error` response for all other GitHub errors; and the `200 []` response when the user has no public repos.

`apiDelete.test.ts` mocks `@/lib/session`, `@/lib/github`, and `@/lib/constants` (setting `DELETION_DELAY_MS` to `0` so the suite finishes in under 2 seconds). It calls `POST()` directly with `NextRequest` objects. The suite covers: the `401` response when no `accessToken` is in the session; `400` responses for every invalid body shape (non-JSON, missing `repos` key, empty array, array exceeding `MAX_BATCH_SIZE`, non-string entries); that `deleteRepo` is called once per repo with the correct token and session-derived owner; the `{ results }` response shape for an all-success batch; continued execution after a per-repo failure with the failed entry marked `status: "error"`; explicit error-message mapping for HTTP `403` (scope), `404` (not found), and `429` (rate limit); and strict sequential call ordering verified by insertion into a shared array rather than by time.

`apiSignout.test.ts` mocks `@/lib/session` at the module boundary and drives `POST()` with `NextRequest` objects constructed by a `makeRequest()` helper (the route accepts a request so it can derive a fallback redirect base from `request.url`). `NEXT_PUBLIC_APP_URL` is set to `'http://localhost:3000'` in `beforeEach` and deleted in `afterEach` to keep tests hermetic. The suite covers: that `session.destroy()` is called exactly once; that the response is a `307` redirect to `http://localhost:3000/`; that the route completes without error when given an already-empty session object (no-op destroy); that the route redirects to the request origin when `NEXT_PUBLIC_APP_URL` is absent; and that the same fallback fires when the env var is set to an invalid URL string.

**Component tests** (`tests/components/`) use React Testing Library with the `jsdom` environment (default). They test interactive client components that depend on React hooks and the DOM.

`SignOutButton.test.tsx` mocks `next/navigation` (providing `useRouter` with `push` and `refresh` stubs), spies on `console.error`, and sets `global.fetch` per describe block. The suite is split into three groups: **success path** (7 cases) — button render, `POST /api/signout` is called, fetch fires exactly once, `router.push('/')` is called, `router.refresh()` is called, focus-ring classes are present, no error alert is shown; **non-2xx failure** (4 cases) — navigation is suppressed when `response.ok` is false, `router.refresh()` is not called, an error `<span role="alert">` appears containing the HTTP status, `console.error` is called with the `[SignOutButton]` prefix; **network error** (4 cases) — same navigation-suppression and alert checks when `fetch` rejects entirely.

`Layout.test.tsx` exercises the nav bar's structural contract via an inline `Nav` component (the real `RootLayout` is an async server component that requires `next/headers` and cannot be driven by Jest directly). The suite covers: the Depo wordmark link pointing to `/`; login name visibility when authenticated vs. unauthenticated; sign-out button visibility; GitHub avatar rendering when `avatarUrl` is provided vs. omitted; and that the unauthenticated state renders no user-section elements.

`RepoList.test.tsx` mocks `next/navigation` (providing a `useRouter` stub with a `push` spy) and clears `sessionStorage` between each test. A `makeRepo()` fixture builder produces `Repo` objects with sensible defaults and per-field overrides; fixture IDs are assigned by an auto-incrementing `idCounter` (reset to 1 at the top of `beforeEach`) rather than `Math.random()`. The shared `repos` array (alpha / beta-fork / gamma) is also re-created in `beforeEach` immediately after the counter reset, so alpha always gets id=1, beta id=2, gamma id=3 without needing explicit overrides, and no test can corrupt the array for a later one. The suite is organised into functional areas: **fork visibility** — forks hidden by default, revealed by the toggle, toggle absent when no forks exist; **search** — case-insensitive name matching, empty-result message; **keyboard interaction** — `Space` and `Enter` on a focused row both toggle selection (dispatched with `fireEvent.keyDown` on the `<li>` reached via `closest('li')`), and a second keypress deselects a selected row; **combined search and fork filter** — enabling the fork toggle then applying a search that only matches the fork exercises both filters simultaneously and triggers the empty-state message when the toggle is disabled again; **row element rendering** — fork badge shown only when `showForks && repo.fork`, star count with `aria-label` rendered only when `stargazerCount > 0`; **relativeTime guard** — rendering a repo with `updatedAt: 'invalid-date'` asserts "just now" is displayed and no "NaN" substring appears, exercising the `isNaN` guard through the full rendering path; **select-all edge cases** — select-all checkbox is `disabled` (not absent) when `visibleRepos` is empty; **select-all toggle** — selects all visible repos on first click, deselects all on second; **Continue flow** — `sessionStorage['depo:selected']` populated, `router.push('/confirm')` called; **display** — relative time rendered, description shown when non-null and absent when null.

### Mock Patterns

Tests mock at the module boundary rather than calling real external services:

```ts
// Mock next/headers (used by server components and API routes)
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

// Mock iron-session
jest.mock('iron-session', () => ({ getIronSession: jest.fn() }))

// Mock @octokit/rest
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }))

// Mock global fetch for API route tests
global.fetch = jest.fn()
```

### End-to-End Tests (Playwright)

```bash
npx playwright test          # run E2E suite (requires running app)
npx playwright test --ui     # interactive UI mode
```

**Playwright configuration**: `config/playwright.config.ts` — Chromium only, `baseURL: http://localhost:3000`. The E2E suite covers full user flows: sign-in, repo selection, confirm, deletion, and summary.

> E2E tests require the app to be running (`npm run dev`) and a valid `.env.local` configured with real GitHub OAuth credentials.

---

## Linting

```bash
npm run lint         # ESLint with eslint-config-next
```

The ESLint config is at `.eslintrc.json`. It extends `next/core-web-vitals` which covers React, accessibility, and Next.js-specific rules.

---

## Type Checking

```bash
npx tsc --noEmit     # type-check without emitting output
```

TypeScript is configured in `tsconfig.json` with `strict: true`. All public APIs use typed interfaces from `lib/types.ts`.

---

## Pre-Commit Checklist

Before pushing:

1. `npm test` — all tests pass
2. `npm run build` — production build succeeds with no TypeScript errors
3. `npm run lint` — no lint warnings or errors
4. Confirm `.env.local` is not staged (`git status`)

---

## Environment Notes

- `lib/sessionOptions.ts` is intentionally separated from `lib/session.ts`: it exports the iron-session config and `SessionData` type without importing `next/headers`. This lets API routes and server components import session config without pulling in Next.js server-only APIs.
- `app/api/delete/route.ts` has a `60s` Vercel function timeout in `vercel.json`. This is required because sequential deletion with 150ms delays can take up to ~15 seconds for a full 100-repo batch.
- The `undici` dev dependency is present to polyfill `fetch` in the Jest environment for route tests.
