'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client component that signs the current user out.
 *
 * Sends `POST /api/signout`, which destroys the iron-session cookie server-side.
 * Navigation to `/` and the subsequent layout refresh only happen when the
 * response is successful (`response.ok`). On a non-2xx response or a network
 * error, navigation is suppressed and a brief error message appears inline next
 * to the button; the error is also logged to the console.
 */
export function SignOutButton() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    setError(null)
    try {
      const res = await fetch('/api/signout', { method: 'POST' })
      if (!res.ok) {
        throw new Error(`Sign-out failed (${res.status})`)
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('[SignOutButton]', err)
      setError(err instanceof Error ? err.message : 'Sign-out failed. Please try again.')
    }
  }

  return (
    <>
      <button
        onClick={handleSignOut}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
      >
        Sign out
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </>
  )
}
