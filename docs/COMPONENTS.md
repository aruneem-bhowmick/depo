# Components and Library Utilities

---

## Server Components (Pages)

These are async React server components rendered in the App Router. They run exclusively on the server and can call `getSession()`, set cookies, and access environment variables directly.

---

### Landing Page (`app/page.tsx`)

**File**: `app/page.tsx`

**Type**: Async server component

The entry point for unauthenticated visitors. Handles the beginning of the OAuth flow.

**Props**:

```ts
interface HomeProps {
  searchParams: { error?: string }
}
```

**Behavior**:

1. **Authenticated redirect**: Calls `getSession()` server-side. If `session.accessToken` is present the component calls `redirect('/repos')` immediately — authenticated users never see the landing page.
2. **CSRF state generation**: Generates a 32-character hex nonce via `randomBytes(16)` and writes it to a `depo_oauth_state` cookie (`httpOnly: true`, `sameSite: 'lax'`, `maxAge: 600` seconds). This nonce is consumed and validated by `GET /api/auth/callback`.
3. **OAuth URL construction**: Builds the GitHub authorize URL with `client_id`, `scope=public_repo,delete_repo`, `redirect_uri`, and the CSRF `state` nonce. The URL is embedded in the `href` of the sign-in anchor.
4. **Error display**: Reads `searchParams.error`. If it matches `auth_failed` or `session_expired`, renders an inline `role="alert"` box with a human-readable message. Unknown error codes produce no alert (silently ignored).

**Rendered elements**:

| Element | Purpose |
|---------|---------|
| `<h1>` | "Delete repos in bulk. Finally." — primary headline |
| `<p>` | One-paragraph explanation of what Depo does |
| `<div role="alert">` | Conditional — only shown when `searchParams.error` maps to a known message |
| `<a href={authUrl}>` | "Sign in with GitHub" link — initiates the OAuth flow |
| `<p>` (scope note) | Discloses `public_repo` and `delete_repo` scope to the user |

**Error messages**:

| `?error=` value | Message displayed |
|-----------------|------------------|
| `auth_failed` | "Sign-in failed. Please try again." |
| `session_expired` | "Your session expired. Please sign in again." |
| *(any other value)* | No alert shown |

**Environment variables read at render time**:

| Variable | Used for |
|----------|---------|
| `GITHUB_CLIENT_ID` | `client_id` parameter of the OAuth URL |
| `NEXT_PUBLIC_APP_URL` | Base URL for the `redirect_uri` parameter |
| `NODE_ENV` | Controls `secure` flag on the `depo_oauth_state` cookie |

**Security note**: The CSRF state nonce is generated server-side with `crypto.randomBytes`, making it cryptographically unpredictable. It is stored as an `httpOnly` cookie (inaccessible to browser JavaScript) and lives for only 10 minutes, limiting the attack window for any stolen nonce.

---

### Repos Page (`app/repos/page.tsx`)

**File**: `app/repos/page.tsx`

**Type**: Async server component

The repo selection page. Protected by middleware — only reachable when `session.accessToken` is present.

**Behavior**:

1. **Session read**: Calls `getSession()` to obtain the authenticated user's access token.
2. **Repo fetch**: Calls `listPublicRepos(session.accessToken)` directly (not via `fetch('/api/repos')`). Calling the library function directly avoids an unnecessary HTTP round-trip to the same server process.
3. **Error path**: If `listPublicRepos` throws, the error is logged server-side via `console.error('[ReposPage] listPublicRepos failed', { login, error })` — the session login and the full error object are included so that operational failures (revoked tokens, GitHub rate limits, transient 5xx) are visible in server logs without exposing the raw access token. The error message is then captured in `fetchError` and an inline `role="alert"` box is rendered alongside a "Try again" anchor (`href="/repos"`). Navigating to that link re-triggers the server-side fetch.
4. **Success path**: The `repos` array (which may be empty) is forwarded as the `repos` prop to `<RepoList>`. The `<RepoList>` client component renders the "No repositories to show." empty state when given an empty array.

**Rendered elements**:

| Element | Condition | Purpose |
|---------|-----------|---------|
| `<h1>Your repositories</h1>` | Always | Page heading |
| `<div role="alert">` | Error path only | Error message from `listPublicRepos` |
| `<a href="/repos">Try again</a>` | Error path only | Navigates back to re-trigger the fetch |
| `<RepoList repos={repos} />` | Success path only | Interactive selection list |

**Server/client split**: `app/repos/page.tsx` is the server boundary. It fetches data and passes it down as props. All interactive state (checkbox selection, search query, fork-visibility toggle) lives in the `<RepoList>` client component.

---

## React Components

All five components are client components (`'use client'`). They are rendered inside server component page shells that pass data as props.

---

### `RepoList`

**File**: `components/RepoList.tsx`

The primary interactive UI. Renders a searchable, filterable list of repositories with multi-select checkboxes and a sticky footer that appears when repos are selected.

**Props**:

```ts
interface RepoListProps {
  repos: Repo[]
}
```

**State**:

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `selected` | `Set<string>` | Empty set | Short names of selected repos |
| `showForks` | `boolean` | `false` | Whether fork repos are visible |
| `search` | `string` | `''` | Current name-filter query |

**Derived values** (each wrapped in `useMemo` — recomputed only when their inputs change):
- `forkCount` — total number of fork repos in the unfiltered list; drives the conditional fork-toggle rendering
- `visibleRepos` — repos after applying the fork filter then the case-insensitive name search in that order
- `allVisibleSelected` — `true` only when every repo in `visibleRepos` is present in `selected`

**Behavior**:
- The fork toggle checkbox only renders when `forkCount > 0`; its `aria-label` reads "Show N fork(s)"
- Clicking any row — or pressing `Space`/`Enter` on a focused row — toggles that repo's selection. The inner `<input type="checkbox">` has `onClick={e => e.stopPropagation()}` to prevent a double-toggle when the user clicks the checkbox element directly
- "Select all" selects all currently *visible* repos (respects both filters simultaneously); if all visible repos are already selected, a second click deselects them all. Repos hidden by either filter are unaffected
- The sticky footer is `position: fixed` and only mounts when `selected.size > 0`; "Continue →" calls `handleContinue`, which serialises the selection with `Array.from(selected)` to `sessionStorage['depo:selected']` and navigates via `router.push('/confirm')`

**Row elements** (per repo): checkbox, monospace repo name, fork badge (only when `showForks && repo.fork`), star count with `aria-label` (only when `stargazerCount > 0`), truncated description paragraph (omitted when `description` is `null`), relative last-updated time via `relativeTime`.

**`relativeTime(iso: string | null): string`** — module-private pure function. Converts an ISO 8601 timestamp to a human-readable relative string ("2d ago", "3mo ago", etc.). Returns `"just now"` for three cases: `null` (repos that have never been pushed to), an unparseable string (guards against `NaN` propagating through the arithmetic chain — `new Date("garbage").getTime()` returns `NaN`, and without this guard the function would return `"NaNy ago"`), and timestamps fewer than 60 seconds old. The parsed timestamp is captured in a named variable and validated with `isNaN` before any arithmetic occurs. Thresholds in ascending order: seconds → minutes → hours → days → months → years.

---

### `DeleteProgress`

**File**: `components/DeleteProgress.tsx`

Fires the deletion request on mount and displays per-repo status indicators.

**Props**:

```ts
interface DeleteProgressProps {
  repos: string[]
  onComplete: (results: DeletionResult[]) => void
}
```

**Behavior**:
- On mount, immediately sends `POST /api/delete` with `{ repos }`
- Shows an indeterminate progress bar while waiting for the response (the route processes sequentially server-side and returns all results at once)
- Once results arrive, renders each repo with a status icon: gray spinner (pending, shown only during loading), green checkmark (`deleted`), or red X with error text (`error`)
- Calls `onComplete(results)` when the response is processed

**Notes**: `/api/delete` returns a single response after all deletions complete. Per-repo streaming via Server-Sent Events is a future enhancement (see [ROADMAP.md](ROADMAP.md)).

---

### `CommandOutput`

**File**: `components/CommandOutput.tsx`

Renders a syntax-highlighted CLI command block with a copy-to-clipboard button.

**Props**:

```ts
interface CommandOutputProps {
  command: string
  mode: 'gh' | 'curl'
}
```

**Behavior**:
- Displays the command in a `<pre><code>` block styled with a dark background (`bg-zinc-900 text-zinc-100`)
- "Copy" button in the top-right corner calls `navigator.clipboard.writeText(command)` and changes its label to "Copied!" for 2 seconds
- For `mode === 'curl'`, renders a yellow warning box above the code block:

  > "This command uses `<your-token>` as a placeholder. Replace it with a GitHub personal access token that has `delete_repo` scope before running. Do not store tokens in shell history."

---

### `ConfirmGate`

**File**: `components/ConfirmGate.tsx`

Forces the user to type the exact count of repos to be deleted before enabling the delete button. The shake animation on incorrect submission is intentional friction that prevents accidental confirmation.

**Props**:

```ts
interface ConfirmGateProps {
  count: number      // exact integer the user must type to unlock the button
  onConfirm: () => void  // called once after a matching click
  loading?: boolean  // when true, disables controls and shows a spinner (default false)
}
```

**State**:

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `input` | `string` | `''` | Current value of the confirmation text input |
| `shaking` | `boolean` | `false` | Drives the `animate-shake` CSS class on the delete button |

**Refs**:

| Ref | Type | Purpose |
|-----|------|---------|
| `shakeTimerRef` | `MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Holds the timeout ID for the shake animation so it can be cancelled on unmount |

**Derived**: `confirmed = input === String(count)` — strict string equality; leading or trailing whitespace does not match.

**Behavior**:

- **Label**: "Type {count} to confirm" — the count is rendered in a `<span>` with `font-mono font-semibold` so the number is visually prominent.
- **Input** (`id="confirm-input"`, `type="text"`, `autoComplete="off"`, `aria-label="Type {count} to confirm"`): bound to `input` state via `onChange`. Width is fixed at `w-32`. Disabled when `loading === true`.
- **Button (inactive state — `!confirmed`)**: styled `bg-zinc-200 opacity-50 cursor-not-allowed`; `aria-disabled="true"`. Clicking while `!confirmed` calls `setShaking(true)`, stores the timeout ID in `shakeTimerRef`, and returns — `onConfirm` is never called.
- **Button (active state — `confirmed && !loading`)**: styled `bg-red-600 hover:bg-red-700 text-white`; `aria-disabled="false"`. Clicking invokes `onConfirm()` immediately.
- **Button label**: `Delete {count} repository` (singular when `count === 1`) or `Delete {count} repositories` (plural otherwise).
- **Loading state** (`loading === true`): `handleSubmit` returns immediately without calling `onConfirm`, even if invoked programmatically (e.g., `fireEvent.click` in tests bypasses the HTML `disabled` attribute in jsdom). Both the input and button are also HTML-`disabled`. The button body is replaced with an `animate-spin` SVG icon and the text "Deleting…".
- **Shake animation**: `animate-shake` class is conditionally appended to the button's class list while `shaking === true`. The keyframe is defined in `config/tailwind.config.ts` (0.4s, `ease-in-out`, ±6px horizontal translate). The class is added synchronously on click and cleared by the `setTimeout` callback after 400ms. A `useEffect` cleanup calls `clearTimeout(shakeTimerRef.current)` on unmount so the callback never fires against an unmounted component.

**Accessibility**:

- The label's `htmlFor="confirm-input"` creates a programmatic association so screen readers announce "Type {count} to confirm" when the input receives focus.
- `aria-disabled={!confirmed}` on the button communicates semantic disabled state even though the button is not HTML-`disabled` before matching — assistive technology announces it as unavailable until the correct count is typed.
- The spinner SVG carries `aria-hidden="true"` so screen readers do not announce it alongside the "Deleting…" text.

**Usage context**: rendered by `app/confirm/page.tsx` inside the "Delete in app" mode branch, passing `count={selected.length}`, `onConfirm={handleConfirm}`, and `loading={deleting}`. The `onConfirm` callback sets `deleting = true`, which mounts `<DeleteProgress>` and triggers the `POST /api/delete` request.

---

### `SignOutButton`

**File**: `components/SignOutButton.tsx`

Client component rendered in the root layout's navigation bar when the user is authenticated. Provides a one-click sign-out action.

**Props**: none

**Behavior**:
1. Sends `POST /api/signout` via `fetch`. The route destroys the `depo_session` cookie server-side.
2. Checks `response.ok`. If the response is successful, calls `router.push('/')` to navigate to the landing page, then `router.refresh()` so the server layout re-renders without session data (hiding the nav user section immediately without a full reload).
3. If the fetch throws (network error) or the response is non-2xx, navigation is suppressed. The error is logged to the console (`[SignOutButton]` prefix) and a brief inline error message appears in a `<span role="alert">` adjacent to the button, leaving the user on the current page.

No authentication check is performed before the fetch — calling sign-out while already signed out is a no-op and safe.

**State**:

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `error` | `string \| null` | `null` | Error message shown inline on fetch failure; reset to `null` at the start of each click |

**Styling**: `text-sm`, hover colour change, `focus:ring-2 focus:ring-violet-500` focus ring for keyboard accessibility. The error message uses `text-xs text-red-500` and is only rendered when non-null.

---

## Library Utilities

---

### `lib/types.ts`

Central location for all shared TypeScript interfaces:

```ts
interface Repo {
  id: number
  name: string          // e.g. "my-project"
  fullName: string      // e.g. "username/my-project"
  description: string | null
  fork: boolean
  stargazerCount: number
  updatedAt: string | null
  url: string
  visibility: 'public' | 'private'
}

interface DeletionResult {
  repo: string
  status: 'deleted' | 'error'
  error?: string        // present only when status === 'error'
}

interface SessionData {
  accessToken: string
  login: string         // GitHub username
  avatarUrl: string
}
```

---

### `lib/constants.ts`

```ts
DELETION_DELAY_MS = 150       // ms between sequential deletions
MAX_BATCH_SIZE    = 100       // max repos per deletion request

SESSION_KEY_SELECTED    = 'depo:selected'
SESSION_KEY_RESULTS     = 'depo:results'
SESSION_KEY_OAUTH_STATE = 'depo:oauth_state'
```

---

### `lib/sessionOptions.ts`

Exports the `iron-session` configuration and the `SessionData` type. Kept separate from `lib/session.ts` so that API routes and server components can import the options without pulling in `next/headers`.

`lib/sessionOptions.ts` also validates `SESSION_SECRET` at **module load time**: if `process.env.SESSION_SECRET` is absent or empty, the module throws immediately:

```
Error: SESSION_SECRET environment variable is required
```

This fail-fast behaviour prevents a misconfigured deployment from serving requests with a broken or empty encryption key that would make session cookies trivially forgeable.

---

### `lib/session.ts`

```ts
export async function getSession(): Promise<IronSession<SessionData>>
```

Thin wrapper around `getIronSession` that reads from `next/headers`. Used only in server components and API routes — never in client components.

---

### `lib/github.ts`

| Export | Signature | Notes |
|--------|-----------|-------|
| `createOctokit` | `(token: string) => Octokit` | Creates an authenticated Octokit instance |
| `listPublicRepos` | `(token: string) => Promise<Repo[]>` | Fetches all pages via `octokit.paginate`. Query parameters: `type: 'owner'`, `visibility: 'public'`, `sort: 'updated'`, `direction: 'desc'`, `per_page: 100`. Maps raw Octokit fields to the internal `Repo` type. |
| `deleteRepo` | `(token, owner, repo) => Promise<void>` | Single repo deletion; throws on error |

---

### `lib/generateCommand.ts`

```ts
type CommandMode = 'gh' | 'curl'

function generateCommand(owner: string, repos: string[], mode: CommandMode): string
```

Builds a shell command string for the given repos and mode.

- **`gh` mode**: one `gh repo delete owner/repo --yes` line per repo
- **`curl` mode**: sets a `TOKEN="<your-token>"` variable followed by one `curl -X DELETE` call per repo; uses `-w "%{http_code} REPONAME\n"` to print the HTTP status code next to each repo name so failures are easy to spot
- **Empty repos array**: returns `''` immediately without validating `owner`
- **Input validation**: `owner` is checked against `/^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/`; each repo name against `/^[A-Za-z0-9._-]+$/`. Violations throw `'Invalid GitHub owner'` or `'Invalid repository name: <name>'`. This blocks shell-injection characters (spaces, semicolons, `$(…)`) from appearing in the generated command string.
