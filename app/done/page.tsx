'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SESSION_KEY_RESULTS, SESSION_KEY_SELECTED } from '@/lib/constants'
import type { DeletionResult } from '@/lib/types'

/**
 * `/done` page — post-deletion summary.
 *
 * On mount the component reads `sessionStorage[SESSION_KEY_RESULTS]`. If the
 * key is absent or the stored JSON is unparseable, the user is redirected to
 * `/` via `router.replace` (the flow is complete or was never started).
 *
 * Both `SESSION_KEY_RESULTS` and `SESSION_KEY_SELECTED` are cleared from
 * `sessionStorage` immediately after the results are parsed. This prevents
 * the user from refreshing and seeing stale data from a previous session.
 *
 * The `mounted` flag prevents a server/client mismatch flash: the component
 * renders `null` until the initial `useEffect` has run and confirmed that
 * valid results exist.
 *
 * **Result display**:
 * - The deleted count is rendered in green (`text-green-600`) when all
 *   deletions succeeded (`failed.length === 0`) and amber (`text-amber-600`)
 *   when one or more repos could not be deleted.
 * - When errors exist a "Failed deletions" list renders each failed repo name
 *   alongside its human-readable error message from `DeletionResult.error`.
 *
 * **Actions**:
 * - "Delete more" navigates to `/repos` so the user can start a fresh selection.
 * - "Sign out" sends `POST /api/signout`, then navigates to `/` and refreshes
 *   the router so the root layout re-renders without session data.
 */
export default function DonePage() {
  const router = useRouter()
  const [results, setResults] = useState<DeletionResult[] | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY_RESULTS)
    if (!raw) {
      router.replace('/')
      return
    }
    try {
      const parsed = JSON.parse(raw) as DeletionResult[]
      setResults(parsed)
      sessionStorage.removeItem(SESSION_KEY_RESULTS)
      sessionStorage.removeItem(SESSION_KEY_SELECTED)
    } catch {
      router.replace('/')
    }
    setMounted(true)
  }, [router])

  if (!mounted || !results) return null

  const deleted = results.filter(r => r.status === 'deleted')
  const failed = results.filter(r => r.status === 'error')
  const allSucceeded = failed.length === 0

  /** Sends `POST /api/signout` then redirects to the landing page. */
  async function handleSignOut() {
    await fetch('/api/signout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p
          className={[
            'text-3xl font-semibold tracking-tight',
            allSucceeded ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
          ].join(' ')}
        >
          {deleted.length} {deleted.length === 1 ? 'repository' : 'repositories'} deleted
        </p>
        {!allSucceeded && (
          <p className="text-sm text-zinc-500 mt-1">
            {failed.length} {failed.length === 1 ? 'repository' : 'repositories'} could not be deleted.
          </p>
        )}
      </div>

      {failed.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Failed deletions</p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
            {failed.map(r => (
              <li key={r.repo} className="flex flex-col px-4 py-3 gap-0.5">
                <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{r.repo}</span>
                <span className="text-xs text-red-500">{r.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/repos')}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          Delete more
        </button>
        <button
          onClick={handleSignOut}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
