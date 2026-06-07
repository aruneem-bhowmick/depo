import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import SignInWithGitHub from '@/components/SignInWithGitHub'

interface HomeProps {
  searchParams: { error?: string }
}

/**
 * Maps known OAuth error codes to user-facing messages shown in the inline alert.
 * Unknown codes produce no message (null), so unrecognised query params are silently ignored.
 */
const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Sign-in failed. Please try again.',
  session_expired: 'Your session expired. Please sign in again.',
}

/**
 * Landing page server component for the Depo application.
 *
 * Authenticated users are immediately redirected to `/repos` without seeing
 * this page. For unauthenticated visitors, renders the marketing headline,
 * a one-paragraph explanation, a "Sign in with GitHub" link, and a disclosure
 * note about the requested OAuth scopes.
 *
 * The sign-in link points to `GET /api/auth/login` rather than directly to
 * GitHub. That Route Handler generates the CSRF state nonce, writes the
 * `depo_oauth_state` cookie, and issues the redirect to GitHub. This
 * separation is required because Next.js only permits cookie mutation in
 * Route Handlers and Server Actions — not in Server Component render functions.
 *
 * When `?error=auth_failed` or `?error=session_expired` appears in the URL,
 * an inline `role="alert"` box is displayed above the sign-in link.
 * Unrecognised `?error` values are silently ignored.
 *
 * @param searchParams - Query parameters parsed from the incoming request URL.
 *   Only the `error` key is consumed; all other keys are ignored.
 */
export default async function Home({ searchParams }: HomeProps) {
  const session = await getSession()

  if (session.accessToken) {
    redirect('/repos')
  }

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] ?? null : null

  return (
    <div className="flex flex-col gap-6 pt-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          Delete repos in bulk. Finally.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          GitHub has no native bulk-deletion interface. Depo lets you select all the
          public repositories you want to remove, review them on a single screen, and
          delete them in one action — or generate a shell command you can run yourself.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <SignInWithGitHub />

        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
          Depo requests{' '}
          <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">public_repo</code>{' '}
          and{' '}
          <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">delete_repo</code>{' '}
          scope. Your token is stored in an encrypted session cookie and never logged.
        </p>
      </div>
    </div>
  )
}
