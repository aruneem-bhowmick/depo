'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Repo } from '@/lib/types'
import { SESSION_KEY_SELECTED } from '@/lib/constants'

interface RepoListProps {
  repos: Repo[]
}

/**
 * Converts an ISO 8601 timestamp to a compact human-readable relative-time
 * string such as "2d ago" or "3mo ago". Returns "just now" for a null
 * timestamp (repos that have never been pushed to), for an unparseable string
 * (guards against NaN propagation through the arithmetic chain), and for
 * timestamps fewer than 60 seconds old. Uses only integer arithmetic — no
 * external date library required.
 *
 * Thresholds (applied in order, earliest match wins):
 * - null / missing / unparseable → "just now"
 * - < 60 s   → "just now"
 * - < 60 min → "{N}m ago"
 * - < 24 h   → "{N}h ago"
 * - < 30 d   → "{N}d ago"
 * - < 12 mo  → "{N}mo ago"
 * - otherwise → "{N}y ago"
 */
function relativeTime(iso: string | null): string {
  if (!iso) return 'just now'
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return 'just now'
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/**
 * Interactive repository list with multi-select checkboxes, name-based search
 * filtering, and an optional fork-visibility toggle.
 *
 * When the user selects one or more repos a sticky footer appears with a
 * "Continue →" button. Clicking it serialises the selected repo names to
 * `sessionStorage` under the `depo:selected` key and navigates to `/confirm`.
 *
 * All filtering is derived state computed with `useMemo`; no filtering state
 * is stored in the component beyond the raw `search` string and `showForks`
 * boolean. The `selected` set tracks repo names (short form, not `fullName`).
 */
export function RepoList({ repos }: RepoListProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showForks, setShowForks] = useState(false)
  const [search, setSearch] = useState('')

  /** Total number of forked repos in the full, unfiltered list. */
  const forkCount = useMemo(() => repos.filter(r => r.fork).length, [repos])

  /**
   * Repos visible after applying the fork filter and the case-insensitive
   * name search. Recomputed only when `repos`, `showForks`, or `search`
   * changes.
   */
  const visibleRepos = useMemo(() =>
    repos
      .filter(r => showForks || !r.fork)
      .filter(r => r.name.toLowerCase().includes(search.toLowerCase())),
    [repos, showForks, search],
  )

  /** True only when every repo currently visible is present in `selected`. */
  const allVisibleSelected =
    visibleRepos.length > 0 && visibleRepos.every(r => selected.has(r.name))

  /**
   * Toggles the selection state of a single repo by name. Selecting an
   * already-selected repo deselects it, and vice versa.
   */
  function toggleRepo(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  /**
   * Toggles the selection state for all currently visible repos.
   *
   * If every visible repo is already selected, all of them are deselected.
   * Otherwise, all visible repos are added to the selection (repos hidden
   * by the fork filter or search are unaffected).
   */
  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        visibleRepos.forEach(r => next.delete(r.name))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        visibleRepos.forEach(r => next.add(r.name))
        return next
      })
    }
  }

  /**
   * Persists the current selection to `sessionStorage` under
   * `SESSION_KEY_SELECTED` and navigates to the confirmation page.
   * Uses `router.push` rather than `window.location.href` so the
   * Next.js router handles the transition.
   */
  function handleContinue() {
    sessionStorage.setItem(SESSION_KEY_SELECTED, JSON.stringify(Array.from(selected)))
    router.push('/confirm')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-zinc-500 tabular-nums">
          {repos.length} repo{repos.length !== 1 ? 's' : ''}
        </span>
        <input
          type="search"
          placeholder="Filter by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Filter repositories by name"
        />
        {forkCount > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showForks}
              onChange={e => setShowForks(e.target.checked)}
              className="rounded"
              aria-label={`Show ${forkCount} fork${forkCount !== 1 ? 's' : ''}`}
            />
            Show forks ({forkCount})
          </label>
        )}
        <label className="flex items-center gap-1.5 text-sm text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAll}
            disabled={visibleRepos.length === 0}
            className="rounded"
            aria-label="Select all visible repositories"
          />
          Select all
        </label>
      </div>

      {/* Repo list */}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
        {visibleRepos.length === 0 ? (
          <li className="py-8 text-center text-sm text-zinc-400">
            {search ? 'No repositories match your search.' : 'No repositories to show.'}
          </li>
        ) : (
          visibleRepos.map(repo => (
            <li
              key={repo.id}
              onClick={() => toggleRepo(repo.name)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
              role="checkbox"
              aria-checked={selected.has(repo.name)}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  toggleRepo(repo.name)
                }
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(repo.name)}
                onChange={() => toggleRepo(repo.name)}
                onClick={e => e.stopPropagation()}
                className="mt-0.5 rounded flex-shrink-0"
                aria-label={`Select ${repo.name}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {repo.name}
                  </span>
                  {showForks && repo.fork && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      fork
                    </span>
                  )}
                  {repo.stargazerCount > 0 && (
                    <span className="text-xs text-zinc-400" aria-label={`${repo.stargazerCount} stars`}>
                      ★ {repo.stargazerCount}
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {repo.description}
                  </p>
                )}
              </div>
              <span className="text-xs text-zinc-400 flex-shrink-0 mt-0.5">
                {relativeTime(repo.updatedAt)}
              </span>
            </li>
          ))
        )}
      </ul>

      {/* Sticky footer — only when repos are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-3 px-4 z-10">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {selected.size} selected
            </span>
            <button
              onClick={handleContinue}
              className="rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              Continue →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
