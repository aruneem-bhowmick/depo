import type { Metadata } from 'next'
import './globals.css'
import { getSession } from '@/lib/session'
import { SignOutButton } from '@/components/SignOutButton'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Depo',
  description: 'Bulk delete GitHub repositories.',
}

/**
 * Root layout for the entire Depo application.
 *
 * Renders the persistent shell: the `<html>` element with a dark-mode
 * initialisation script (prevents FOUC), a Tailwind `font-sans` body, a top
 * navigation bar, and the `<main>` content area.
 *
 * The navigation bar shows the Depo wordmark on the left and — when the user is
 * authenticated — their GitHub avatar, login name, and a sign-out button on the
 * right. Session presence is checked server-side via `getSession()`.
 *
 * The dark-mode script is inlined in `<head>` so it executes synchronously
 * before the first paint, applying the `dark` class to `<html>` when the user's
 * OS preference is dark. `suppressHydrationWarning` prevents React from warning
 * about the class mismatch introduced by this script.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen relative">
        <header className="relative z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
            <Link
              href="/"
              className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-80 transition-opacity"
            >
              Depo
            </Link>
            {session.accessToken && (
              <div className="flex items-center gap-3">
                {session.avatarUrl && (
                  <Image
                    src={session.avatarUrl}
                    alt={session.login}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                )}
                <span className="text-sm text-zinc-500">{session.login}</span>
                <SignOutButton />
              </div>
            )}
          </div>
        </header>
        <main className="relative max-w-2xl mx-auto px-4 py-8">
          {/* Light mode: dark dots */}
          <div
            className="fixed inset-0 pointer-events-none dark:hidden"
            style={{
              top: '3rem',
              zIndex: 0,
              backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px)',
              backgroundSize: '10px 10px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 70%)',
            }}
          />
          {/* Dark mode: white dots */}
          <div
            className="hidden dark:block fixed inset-0 pointer-events-none"
            style={{
              top: '3rem',
              zIndex: 0,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
              backgroundSize: '10px 10px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 70%)',
            }}
          />
          {children}
        </main>
      </body>
    </html>
  )
}
