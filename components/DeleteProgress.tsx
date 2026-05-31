'use client'

import { useEffect, useState } from 'react'
import type { DeletionResult } from '@/lib/types'

interface DeleteProgressProps {
  repos: string[]
  onComplete: (results: DeletionResult[]) => void
}

/**
 * Fires `POST /api/delete` once on mount and renders the deletion progress.
 *
 * While the request is in flight the component shows an indeterminate progress
 * bar with a count label. Once the response arrives it renders each repo with a
 * per-row status icon: a green checkmark for `'deleted'` or a red X with the
 * error message for `'error'`. After results are set, `onComplete` is called so
 * the parent can navigate to the summary page.
 *
 * If the `fetch` call itself throws (e.g. a network failure) a red alert box is
 * rendered and `onComplete` is never called.
 *
 * @param repos      - Short repository names to delete (not `owner/repo` form).
 * @param onComplete - Callback invoked with the full results array once the API
 *                     responds. The parent is responsible for persisting results
 *                     and navigating away.
 */
export function DeleteProgress({ repos, onComplete }: DeleteProgressProps) {
  const [results, setResults] = useState<DeletionResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    /**
     * Sends the deletion request and updates component state with the results.
     * Runs exactly once when the component mounts — the empty dependency array
     * ensures it does not re-fire if the parent re-renders.
     */
    async function run() {
      try {
        const res = await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repos }),
        })
        if (!res.ok) {
          const errData = await res.json() as { error?: string }
          setError(errData.error ?? 'Deletion failed. Please try again.')
          return
        }
        const data = await res.json() as { results: DeletionResult[] }
        setResults(data.results)
        onComplete(data.results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Deletion failed. Please try again.')
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!results) {
    return (
      <div className="flex flex-col gap-3">
        <div
          role="progressbar"
          aria-label="Deleting repositories…"
          className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"
        >
          <div className="h-full bg-violet-500 animate-[pulse_1.5s_ease-in-out_infinite] w-1/3 rounded-full" />
        </div>
        <p className="text-sm text-zinc-500">Deleting {repos.length} {repos.length === 1 ? 'repository' : 'repositories'}…</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
      {results.map(r => (
        <li key={r.repo} className="flex flex-col px-4 py-3 gap-1">
          <div className="flex items-center gap-3">
            {r.status === 'deleted' ? (
              <svg aria-label="Deleted" className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg aria-label="Error" className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-mono text-sm">{r.repo}</span>
          </div>
          {r.error && (
            <p className="text-xs text-red-500 ml-7">{r.error}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
