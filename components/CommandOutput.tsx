'use client'

import { useState } from 'react'
import type { CommandMode } from '@/lib/generateCommand'

interface CommandOutputProps {
  command: string
  mode: CommandMode
}

/**
 * Renders a shell command in a dark code block with a one-click copy button.
 *
 * For `mode === 'curl'` a yellow informational banner is rendered above the
 * block, reminding the user to replace the `<your-token>` placeholder with a
 * real personal access token and warning them not to store credentials in
 * shell history.
 *
 * @param command - The full shell script string to display (may be multi-line).
 * @param mode    - `'gh'` for GitHub CLI output or `'curl'` for raw HTTP output.
 *                  Only `'curl'` triggers the token-placeholder warning banner.
 */
export function CommandOutput({ command, mode }: CommandOutputProps) {
  const [copied, setCopied] = useState(false)

  /**
   * Copies `command` to the clipboard.
   *
   * On success, flips the button label to "Copied!" for 2 seconds then reverts
   * to "Copy". On failure (e.g., non-HTTPS context or browser permission denied)
   * the error is silently swallowed — the button label does not change.
   */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failed (e.g., non-HTTPS) — silently ignore
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {mode === 'curl' && (
        <div
          role="note"
          className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300"
        >
          This command uses{' '}
          <code className="font-mono bg-yellow-100 dark:bg-yellow-900 px-1 rounded">&lt;your-token&gt;</code>{' '}
          as a placeholder. Replace it with a GitHub personal access token that has{' '}
          <code className="font-mono bg-yellow-100 dark:bg-yellow-900 px-1 rounded">delete_repo</code>{' '}
          scope before running. Do not store tokens in shell history.
        </div>
      )}
      <div className="relative rounded-md overflow-hidden border border-zinc-700">
        <button
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy command'}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 z-10"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <pre className="bg-zinc-900 text-zinc-100 p-4 text-xs overflow-x-auto pr-20 leading-relaxed">
          <code>{command}</code>
        </pre>
      </div>
    </div>
  )
}
