'use client'

import { useState } from 'react'

/**
 * Props for the ConfirmGate component.
 *
 * @property count   - The exact integer the user must type to unlock the delete button.
 * @property onConfirm - Callback invoked once the user types the correct count and clicks.
 * @property loading - When true the input and button are disabled and the button shows a spinner.
 */
interface ConfirmGateProps {
  count: number
  onConfirm: () => void
  loading?: boolean
}

/**
 * A type-count confirmation gate that forces deliberate intent before a
 * destructive bulk-delete operation.
 *
 * The user must type the exact integer value of `count` into the text field
 * before the delete button becomes active. Clicking the button with a
 * non-matching value triggers a 400ms CSS shake animation (defined as
 * `animate-shake` in the Tailwind configuration) and returns without invoking
 * `onConfirm`.
 *
 * When `loading` is true — indicating that the deletion request is in flight —
 * both the input and the button are disabled and the button label is replaced
 * with a spinning SVG icon and the text "Deleting…".
 *
 * Accessibility:
 * - The input carries an explicit `aria-label` of "Type {count} to confirm".
 * - The button carries `aria-disabled={!confirmed}` so screen readers announce
 *   the semantic disabled state even though the button is not HTML-disabled
 *   while waiting for the user to type.
 */
export function ConfirmGate({ count, onConfirm, loading = false }: ConfirmGateProps) {
  const [input, setInput] = useState('')
  const [shaking, setShaking] = useState(false)

  /** True only when the typed value equals the string representation of count. */
  const confirmed = input === String(count)

  /**
   * Handles the delete-button click.
   *
   * If the input does not match `count`, the shake animation fires and the
   * handler returns early — `onConfirm` is never called. If the input matches,
   * `onConfirm` is called immediately.
   */
  function handleSubmit() {
    if (!confirmed) {
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    onConfirm()
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm text-zinc-600 dark:text-zinc-400" htmlFor="confirm-input">
        Type <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{count}</span> to confirm
      </label>
      <input
        id="confirm-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={String(count)}
        autoComplete="off"
        className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-32"
        aria-label={`Type ${count} to confirm`}
        disabled={loading}
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        aria-disabled={!confirmed}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 w-fit',
          confirmed && !loading
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-50 cursor-not-allowed',
          shaking ? 'animate-shake' : '',
        ].join(' ')}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Deleting…
          </>
        ) : (
          `Delete ${count} ${count === 1 ? 'repository' : 'repositories'}`
        )}
      </button>
    </div>
  )
}
