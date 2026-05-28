# Roadmap

---

## v1 Scope

Depo v1 is a focused, single-purpose tool. It does one thing well: bulk-delete public GitHub repositories.

**What v1 does**:
- Authenticate via GitHub OAuth
- List all public repositories owned by the authenticated user
- Multi-select with search and fork filtering
- Delete in-app (browser calls GitHub API) or generate a `gh`/`curl` CLI command
- Require a type-count confirmation gate before any deletion
- Display per-repo deletion status and a final summary

---

## v1 Non-Goals

These are intentionally out of scope for v1:

- **Private repositories** — requires the `repo` OAuth scope, which grants broad write access. The friction of a dedicated v1.1 release is a deliberate safety measure.
- **Organization repositories** — org repos require separate API calls (`listForOrg`) and an org selector UI. Out of scope for the initial single-user tool.
- **Repository content** — Depo does not interact with branches, commits, issues, pull requests, or files.
- **Persistent storage** — no database, no user accounts, no saved preferences. The session cookie is the entirety of server-side state.
- **Analytics or telemetry** — Depo does not track usage, errors, or behavior.

---

## Future Enhancements

### Private Repository Support

Requires adding the `repo` OAuth scope (which GitHub's OAuth UI will warn users about prominently) and a clear in-app warning that Depo can now see and delete private repos. The architecture already supports it — the `Repo` interface has a `visibility` field and `listPublicRepos` in `lib/github.ts` could be extended with a `visibility` parameter.

### Organization Repository Support

Would add an org selector dropdown to the repos page and separate API calls to `octokit.repos.listForOrg`. The session would need to store the selected org context, or the user could switch between personal and org views.

### Streamed Deletion Progress

The current `/api/delete` route processes repos sequentially server-side and returns all results in a single response. The UI shows an indeterminate spinner until everything completes. A future iteration could replace this with Server-Sent Events (SSE) to push per-repo status updates in real time as each deletion completes, giving the user live feedback on a 100-repo batch.

### Undo (Zip Before Delete)

GitHub has no soft-delete — a deleted repository is gone. A possible mitigation: before deletion, automatically create a `.zip` download of each selected repo (using the GitHub archive API) and bundle them into a single download for the user. This is a substantial feature with storage and streaming complexity.

### Saved Selections

Persist a user's selection across sessions using a lightweight database (e.g., PlanetScale, Neon, or Vercel KV) keyed on GitHub `login`. Would let users build a "deletion queue" over multiple visits.

### Rate Limit Display

Show the user's current GitHub API rate limit status (`GET /rate_limit`) in the UI — e.g., "4,872 / 5,000 requests remaining, resets in 47 minutes." Particularly useful for power users running large batches or using Depo alongside other GitHub tooling.
