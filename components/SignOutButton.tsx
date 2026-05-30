'use client'

import { useRouter } from 'next/navigation'

/**
 * Client component that signs the current user out.
 *
 * Sends a POST to `/api/signout`, which destroys the iron-session cookie,
 * then navigates to `/` and calls `router.refresh()` so the server layout
 * re-renders without session data (hiding the nav user section).
 */
export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/signout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
    >
      Sign out
    </button>
  )
}
