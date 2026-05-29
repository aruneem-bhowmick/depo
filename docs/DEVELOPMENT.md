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
│   ├── types.test.ts           Repo / DeletionResult / SessionData conformance
│   └── vercelJson.test.ts      vercel.json maxDuration for delete route
└── integration/
    ├── middleware.test.ts       auth redirect behavior (14 cases)
    ├── authCallback.test.ts    OAuth callback: CSRF validation, env vars, network errors, token exchange, session write (9 cases)
    └── apiRepos.test.ts        GET /api/repos: unauthenticated, empty list, repo array, revoked-token 401, GitHub 500 (6 cases)
```

**Jest configuration**: `config/jest.config.ts` — rootDir `../`, jsdom environment, ts-jest transform, setup file at `config/jest.setup.ts` (imports `@testing-library/jest-dom`).

**Integration tests** (`tests/integration/`) test cross-cutting behaviour that requires module interaction. No test spins up an HTTP server — they drive route/middleware handlers directly with `NextRequest` objects (or no argument for routes that take none). All integration tests use a `@jest-environment node` docblock because Next.js server-side APIs require Node globals rather than jsdom.

`middleware.test.ts` mocks `iron-session` at the module boundary and drives `middleware()` directly. The suite covers: authenticated access (no redirect), unauthenticated access (redirect to `/`), corrupted-cookie error path (redirect to `/`), and path-matching precision (e.g., confirming `/repos-test` is not intercepted).

`authCallback.test.ts` mocks `@/lib/session` and `next/headers` before imports (preventing the `SESSION_SECRET` startup guard in `sessionOptions.ts` from running), and replaces `global.fetch` with a Jest mock for controlled token exchange and user profile responses. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are stubbed in `beforeEach` and cleaned up in `afterEach` so tests that reach the token exchange path are not blocked by the env var guard. The suite covers: all CSRF failure paths (missing/mismatched state, missing code), the env var guard, token exchange network failure (fetch throws), token exchange response failures (error field, missing access_token), user profile fetch returning a non-OK status, and the full success path — session fields (`accessToken`, `login`, `avatarUrl`) written correctly, redirect to `/repos`, `depo_oauth_state` cookie deleted (verified via the `Set-Cookie` response header).

`apiRepos.test.ts` mocks `@/lib/session` and `@/lib/github` at the module boundary and calls `GET()` directly. The suite covers: the `401` response when no `accessToken` is present in the session; the `200` response with a correctly shaped `Repo[]` array; that `listPublicRepos` receives exactly the `accessToken` from the session; the `401 Session expired` response when GitHub returns a `401` (revoked token); the `500 GitHub API error` response for all other GitHub errors; and the `200 []` response when the user has no public repos.

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
