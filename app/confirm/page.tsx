'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmGate } from '@/components/ConfirmGate'
import { CommandOutput } from '@/components/CommandOutput'
import { DeleteProgress } from '@/components/DeleteProgress'
import { SESSION_KEY_SELECTED, SESSION_KEY_RESULTS } from '@/lib/constants'
import { generateCommand } from '@/lib/generateCommand'
import type { DeletionResult } from '@/lib/types'

/** The three output modes available on the confirmation page. */
type OutputMode = 'app' | 'gh' | 'curl'

/**
 * `/confirm` page — review and execute a bulk repository deletion.
 *
 * On mount the component reads `sessionStorage[SESSION_KEY_SELECTED]`. If the
 * key is absent, unparseable, or contains an empty array the user is redirected
 * back to `/repos` via `router.replace` so they can start a new selection.
 *
 * The `mounted` flag prevents a server/client mismatch flash: the component
 * renders `null` until the initial `useEffect` has run and confirmed that a
 * valid selection exists.
 *
 * **Output modes** (controlled by the segmented button group):
 * - `'app'`  — delete via the API (shows `<ConfirmGate>` then `<DeleteProgress>`).
 * - `'gh'`   — shows a generated `gh repo delete` CLI script in `<CommandOutput>`.
 * - `'curl'` — shows a generated `curl -X DELETE` script in `<CommandOutput>`.
 *
 * After in-app deletion completes, results are written to
 * `sessionStorage[SESSION_KEY_RESULTS]`, `SESSION_KEY_SELECTED` is cleared, and
 * the user is navigated to `/done`.
 */
export default function ConfirmPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [owner, setOwner] = useState<string>('')
  const [mode, setMode] = useState<OutputMode>('app')
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY_SELECTED)
    if (!raw) {
      router.replace('/repos')
      return
    }
    try {
      const parsed = JSON.parse(raw) as string[]
      if (!Array.isArray(parsed) || parsed.length === 0) {
        router.replace('/repos')
        return
      }
      setSelected(parsed)
    } catch {
      router.replace('/repos')
    }
    setMounted(true)
  }, [router])

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((data: { login: string }) => setOwner(data.login))
      .catch(() => {/* owner stays empty; commands won't show until resolved */})
  }, [])

  /** Transitions from the ConfirmGate view to the DeleteProgress view. */
  function handleConfirm() {
    setDeleting(true)
  }

  /**
   * Called by `DeleteProgress` once the API response arrives.
   *
   * Persists the results to `sessionStorage` for the `/done` page to read,
   * removes the selection key (the flow is complete), then navigates to `/done`.
   *
   * @param results - Per-repo deletion outcomes returned by `POST /api/delete`.
   */
  function handleDeletionComplete(results: DeletionResult[]) {
    sessionStorage.setItem(SESSION_KEY_RESULTS, JSON.stringify(results))
    sessionStorage.removeItem(SESSION_KEY_SELECTED)
    router.push('/done')
  }

  if (!mounted) return null

  const ghCommand = owner ? generateCommand(owner, selected, 'gh') : ''
  const curlCommand = owner ? generateCommand(owner, selected, 'curl') : ''

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">
          You selected {selected.length} {selected.length === 1 ? 'repository' : 'repositories'} for deletion.
        </h1>
        <a
          href="#"
          onClick={e => { e.preventDefault(); router.back() }}
          className="text-sm text-violet-600 hover:underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          ← Change selection
        </a>
      </div>

      {/* Read-only list of selected repos */}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden max-h-60 overflow-y-auto">
        {selected.map(name => (
          <li key={name} className="flex items-center gap-2 px-4 py-2.5">
            <svg aria-hidden="true" className="text-red-400 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="font-mono text-sm">{name}</span>
          </li>
        ))}
      </ul>

      {/* Output mode selector */}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Output mode</p>
        <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden" role="group" aria-label="Output mode">
          {(['app', 'gh', 'curl'] as OutputMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-violet-500',
                mode === m
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
              ].join(' ')}
              aria-pressed={mode === m}
            >
              {m === 'app' ? 'Delete in app' : m === 'gh' ? 'Generate gh command' : 'Generate curl command'}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional command output — only rendered when owner has resolved */}
      {(mode === 'gh' || mode === 'curl') && owner && (
        <CommandOutput
          command={mode === 'gh' ? ghCommand : curlCommand}
          mode={mode}
        />
      )}

      {mode === 'app' && (
        !deleting ? (
          <ConfirmGate
            count={selected.length}
            onConfirm={handleConfirm}
          />
        ) : (
          <DeleteProgress
            repos={selected}
            onComplete={handleDeletionComplete}
          />
        )
      )}
    </div>
  )
}
