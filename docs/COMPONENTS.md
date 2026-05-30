# Components and Library Utilities

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
  initialLogin: string
}
```

**State**:

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `selected` | `Set<string>` | Empty set | Names of selected repos |
| `showForks` | `boolean` | `false` | Whether fork repos are visible |
| `search` | `string` | `''` | Current search query |

**Derived values**:
- `forkCount` — total number of fork repos in the list
- `visibleRepos` — repos after applying fork filter and search filter (case-insensitive `includes`)
- `allVisibleSelected` — true when all visible repos are checked

**Behavior**:
- The fork toggle only renders when `forkCount > 0`; its label shows "Show forks (N)"
- Clicking any row toggles that repo's checkbox
- "Select all" selects all currently *visible* repos (respects both filters); if all visible repos are already selected, it deselects all
- The sticky footer appears when `selected.size > 0`. "Continue →" serializes the selection to `sessionStorage['depo:selected']` and navigates to `/confirm`

**Row elements** (per repo): checkbox, monospace repo name, truncated description (omitted if null), star count, fork badge (only when forks are shown), relative last-updated time.

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

Forces the user to type the exact count of repos to be deleted before enabling the delete button. The shake animation on incorrect submission is intentional friction.

**Props**:

```ts
interface ConfirmGateProps {
  count: number
  onConfirm: () => void
  loading?: boolean
}
```

**State**:

| State | Type | Purpose |
|-------|------|---------|
| `input` | `string` | Current value of the confirmation input |
| `shaking` | `boolean` | Triggers the shake animation on the button |

**Derived**: `confirmed = input === String(count)`

**Behavior**:
- Label reads "Type {count} to confirm"
- The delete button is `disabled` and `opacity-50 cursor-not-allowed` when `!confirmed`
- When confirmed, the button turns red (`bg-red-600`)
- Clicking the button while `!confirmed` triggers a 400ms shake animation (CSS keyframes defined in `config/tailwind.config.ts` as `animate-shake`) and does nothing else
- When `loading === true`, the button shows a spinner instead of text

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
