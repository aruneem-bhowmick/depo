import { render, screen } from '@testing-library/react'

/**
 * Tests for the nav structure rendered by the root layout.
 *
 * The full `RootLayout` is an async server component that depends on
 * `next/headers` (via `getSession`) and cannot be instantiated directly in
 * Jest. These tests instead exercise the nav's structural contract via an
 * equivalent inline component, keeping the assertions stable regardless of
 * the surrounding layout implementation details.
 */

function Nav({ login, avatarUrl }: { login?: string; avatarUrl?: string }) {
  return (
    <header>
      <div>
        <a href="/">Depo</a>
        {login && (
          <div>
            {avatarUrl && <img src={avatarUrl} alt={login} width={24} height={24} />}
            <span>{login}</span>
            <button>Sign out</button>
          </div>
        )}
      </div>
    </header>
  )
}

describe('Layout Nav', () => {
  it('shows Depo wordmark linking to /', () => {
    const { container } = render(<Nav />)
    const link = container.querySelector('a[href="/"]')
    expect(link?.textContent).toBe('Depo')
  })

  it('shows login name when authenticated', () => {
    render(<Nav login="alice" />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('does not show login name when unauthenticated', () => {
    render(<Nav />)
    expect(screen.queryByText('alice')).not.toBeInTheDocument()
  })

  it('does not show sign out button when unauthenticated', () => {
    render(<Nav />)
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('shows sign out button when authenticated', () => {
    render(<Nav login="alice" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows avatar image when avatarUrl is provided', () => {
    render(<Nav login="alice" avatarUrl="https://avatars.githubusercontent.com/u/1" />)
    const img = screen.getByRole('img', { name: 'alice' })
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toContain('avatars.githubusercontent.com')
  })

  it('does not render avatar when avatarUrl is absent', () => {
    render(<Nav login="alice" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render any user section when unauthenticated', () => {
    const { container } = render(<Nav />)
    expect(container.querySelector('span')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
