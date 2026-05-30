import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

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
        <a
          href="/api/auth/login"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 w-fit"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width={16}
            height={16}
            fill="currentColor"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Sign in with GitHub
        </a>

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
