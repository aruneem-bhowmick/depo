# Architecture

Depo is a Next.js 14 App Router application deployed as serverless functions on Vercel. It has no database — all state is held in an encrypted session cookie, a short-lived CSRF cookie, and the browser's `sessionStorage`.

---

## Request Flow

```
User
 │
 ├── GET /                    Landing page — renders sign-in UI
 │        │                   Authenticated users are immediately redirected to /repos
 │        │
 │        └── (clicks "Sign in") ──► GET /api/auth/login
 │                                         │
 │                                         ├── Generates CSRF nonce
 │                                         ├── Sets depo_oauth_state cookie
 │                                         └── 307 redirect ──► GitHub OAuth
 │                                                                    │
 │                                          (GitHub redirects back) ──┘
 │                                                 │
 │                                          GET /api/auth/callback
 │                                                 │
 │                                                 ├── Validates state (CSRF check)
 │                                                 ├── Exchanges code for token
 │                                                 ├── Writes session cookie
 │                                                 └── Deletes depo_oauth_state, redirects ──►
 │
 ├── GET /repos  ──► middleware: validate depo_session cookie
 │        │              │
 │        │         no accessToken / corrupted cookie ──► redirect to /
 │        │
 │        ├── GET /api/repos  (server-side, reads session cookie)
 │        │
 │        └── "Continue" ──── saves selection to sessionStorage ──►
 │
 ├── GET /confirm  ──► middleware (same check)
 │        │
 │        ├── POST /api/delete  (if "Delete in app" mode)
 │        │
 │        └── Saves results to sessionStorage ──►
 │
 └── GET /done  ──► middleware (same check)
                    Summary of deleted / failed repos
```

---

## Pages

| Route | Rendering | Purpose |
|-------|-----------|---------|
| `/` | Async server component | Landing page: redirects authenticated users to `/repos`; for unauthenticated visitors, renders the sign-in UI — CSRF nonce generation and cookie writing happen in `GET /api/auth/login` when the user clicks the sign-in link |
| `/repos` | Server shell + client `<RepoList>` | Fetch repos, multi-select, navigate to confirm |
| `/confirm` | Client component | Review selection, choose output mode, trigger deletion |
| `/done` | Client component | Display deletion results, offer sign-out or delete more |

The server/client split is intentional: pages that need `sessionStorage` or interactive state are client components; data-fetching entry points are server components that pass data as props.

---

## API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/api/auth/login` | None | Generate CSRF nonce, set `depo_oauth_state` cookie, redirect to GitHub OAuth |
| `GET` | `/api/auth/callback` | None | Exchange GitHub OAuth code for access token, set session |
| `GET` | `/api/repos` | Session cookie | Return authenticated user's public repos |
| `POST` | `/api/delete` | Session cookie | Sequentially delete selected repos with rate-limit delay |
| `POST` | `/api/signout` | None | Destroy session cookie, redirect to `/` |

See [API.md](API.md) for full request/response documentation.

---

## Middleware

`middleware.ts` runs at the Next.js edge before any server component or API route handler on the protected paths.

**Protected paths**: `/repos`, `/confirm`, `/done` and all sub-paths (matched via `'/repos/:path*'`, `'/confirm/:path*'`, `'/done/:path*'`).

**Auth check**: reads the `depo_session` cookie using `getIronSession`. If `session.accessToken` is falsy, returns a `307` redirect to `/`. If the cookie exists but is corrupted or unreadable (tampered or encrypted with a different secret), the decryption error is caught and the middleware still redirects to `/`.

**Path matching precision**: the `:path*` matcher patterns prevent false-positive matches on paths such as `/repos-test` or `/confirm-email`.

**Note**: `/api/repos` and `/api/delete` perform their own independent session checks and return `401` for unauthenticated API calls. The middleware is a first-line guard for page routes only.

---

## Session Strategy

Depo uses [`iron-session`](https://github.com/vvo/iron-session) — an encrypted, signed, HTTP-only cookie. There is no database.

| Property | Value |
|----------|-------|
| Cookie name | `depo_session` |
| Encryption | AES-256-CBC via `iron-session` |
| Storage | Browser cookie only — never server-side storage |
| Expiry | 8 hours (`maxAge: 60 * 60 * 8`) |
| Security flags | `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production |

The GitHub access token lives exclusively inside this cookie and is read server-side in API routes. It is never included in API responses or visible to client-side JavaScript.

---

## State Between Pages

Cross-page state is stored in two different mechanisms depending on its security requirements:

### sessionStorage (client-side, tab-scoped)

| Key (`lib/constants.ts`) | Type | Set by | Read by | Cleared by |
|--------------------------|------|--------|---------|------------|
| `depo:selected` | `string[]` (repo names) | `/repos` "Continue" button | `/confirm` on mount | `/done` on mount |
| `depo:results` | `DeletionResult[]` | `/confirm` after deletion | `/done` on mount | `/done` on mount |

### HTTP Cookie (server-side, httpOnly)

| Cookie name | Type | Set by | Read by | Cleared by |
|-------------|------|--------|---------|------------|
| `depo_oauth_state` | `string` (hex CSRF nonce) | Landing page (`app/page.tsx`) via `cookies().set()` | `GET /api/auth/callback` via `cookies().get()` | Callback route on successful validation, via `response.cookies.delete()` |

> **Why a cookie and not sessionStorage for the OAuth state?** The CSRF nonce must survive a cross-origin navigation (browser → GitHub → back to the app). `sessionStorage` is not accessible from the callback URL during a redirect, so the nonce is stored as an `httpOnly` server-readable cookie instead. `httpOnly` prevents client-side JavaScript from reading or tampering with the nonce.

---

## Global Layout

`app/layout.tsx` is the root server component that wraps every page. It:

- Loads the **Inter** font via `next/font/google` and applies it to `<body>` so the typeface is self-hosted (no third-party font request at runtime).
- Inlines a **dark-mode initialisation script** synchronously in `<head>`. The script checks `window.matchMedia('(prefers-color-scheme: dark)')` and adds the `dark` class to `<html>` before the first paint, preventing a flash of unstyled content. `suppressHydrationWarning` is set on `<html>` to suppress the React hydration warning that would otherwise appear because the class is added by a non-React script.
- Calls `getSession()` server-side and renders a **navigation bar** with the Depo wordmark (left) and — when `session.accessToken` is present — the user's GitHub avatar (24×24 circle), login name, and `<SignOutButton />` (right).
- Wraps page content in `<main className="max-w-2xl mx-auto px-4 py-8">` — the same `max-w-2xl` constraint used by the header inner div ensures consistent narrow-width layout on all pages.

**Dark mode strategy**: `darkMode: 'class'` in `config/tailwind.config.ts`. Tailwind generates dark-variant utilities (`dark:bg-zinc-950`, `dark:text-zinc-100`, etc.) that activate when `<html>` has the `dark` class. The class is set by the inline script on load and never toggled at runtime — theme follows OS preference.

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14 | App Router, server components, API routes, middleware |
| `react` / `react-dom` | 18 | UI rendering |
| `iron-session` | 8 | Encrypted HTTP-only session cookies |
| `@octokit/rest` | 22 | GitHub REST API client with pagination |
| `tailwindcss` | 3 | Utility-first CSS with `class`-based dark mode and custom `shake` animation |
| `typescript` | 5 | Static typing throughout |

---

## Project Structure

```
depo/
├── app/
│   ├── layout.tsx                  Root layout (nav, metadata, dark mode init)
│   ├── page.tsx                    Landing page
│   ├── repos/page.tsx              Repo list + selection
│   ├── confirm/page.tsx            Confirmation + output mode + deletion trigger
│   ├── done/page.tsx               Post-deletion summary
│   └── api/
│       ├── auth/callback/route.ts  OAuth code exchange
│       ├── repos/route.ts          List public repos
│       ├── delete/route.ts         Bulk delete (sequential, 150ms delay)
│       └── signout/route.ts        Session destruction
│
├── components/
│   ├── RepoList.tsx                Checkbox list with search and fork toggle
│   ├── DeleteProgress.tsx          Live deletion status display
│   ├── CommandOutput.tsx           CLI command block with copy button
│   ├── ConfirmGate.tsx             Type-count confirmation input
│   └── SignOutButton.tsx           Sign-out action button
│
├── lib/
│   ├── types.ts                    Shared TypeScript interfaces
│   ├── constants.ts                App-wide constants
│   ├── sessionOptions.ts           iron-session config (no next/headers dependency)
│   ├── session.ts                  getSession() helper (uses next/headers)
│   ├── github.ts                   Octokit wrapper + typed helpers
│   └── generateCommand.ts          gh/curl command string builder
│
├── middleware.ts                   Redirect unauthenticated users from protected routes
│                                   (matcher: /repos/:path*, /confirm/:path*, /done/:path*)
├── docs/                           This documentation
├── docs-depo/                      Internal spec and implementation guide
└── config/                         Jest, Playwright, Tailwind configuration
```

**`next.config.ts`**: written in TypeScript (not `.mjs`). Configured with `images.domains: ['avatars.githubusercontent.com']` to allow Next.js image optimization for GitHub user avatars.

**`config/tailwind.config.ts`**: Tailwind configuration. Key settings:
- `darkMode: 'class'` — dark mode is toggled by the `dark` class on `<html>`, set by the inline layout script.
- `content` scans `./app/**/*.{ts,tsx}` and `./components/**/*.{ts,tsx}`.
- Custom `shake` keyframe animation (0.4s, `ease-in-out`) used by `ConfirmGate` when a wrong count is submitted.
- Loaded by `postcss.config.js` via `tailwindcss: { config: './config/tailwind.config.ts' }`.
