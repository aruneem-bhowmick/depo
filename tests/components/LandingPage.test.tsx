import { render, screen } from '@testing-library/react'

jest.mock('@/lib/session', () => ({
  getSession: jest.fn().mockResolvedValue({ accessToken: undefined }),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

import Home from '@/app/page'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

// Double-cast required: jest transforms these at runtime but TypeScript only
// sees the original library types, which don't overlap with jest.Mock.
const mockRedirect = redirect as unknown as jest.Mock
const mockGetSession = getSession as unknown as jest.Mock

describe('Landing Page — authenticated redirect', () => {
  it('redirects authenticated users to /repos without rendering the page', async () => {
    mockGetSession.mockResolvedValueOnce({ accessToken: 'gho_tok' })
    await Home({ searchParams: {} })
    expect(mockRedirect).toHaveBeenCalledWith('/repos')
  })
})

describe('Landing Page', () => {
  it('renders the headline', async () => {
    const jsx = await Home({ searchParams: {} })
    render(jsx as React.ReactElement)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Delete repos in bulk. Finally.'
    )
  })

  it('renders the Sign in with GitHub link pointing to /api/auth/login', async () => {
    const jsx = await Home({ searchParams: {} })
    render(jsx as React.ReactElement)
    const link = screen.getByRole('link', { name: /sign in with github/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/api/auth/login')
  })

  it('mentions delete_repo scope in the privacy note', async () => {
    const jsx = await Home({ searchParams: {} })
    render(jsx as React.ReactElement)
    expect(screen.getByText(/delete_repo/)).toBeInTheDocument()
  })

  it('shows auth_failed error when ?error=auth_failed', async () => {
    const jsx = await Home({ searchParams: { error: 'auth_failed' } })
    render(jsx as React.ReactElement)
    expect(screen.getByRole('alert')).toHaveTextContent(/sign-in failed/i)
  })

  it('shows session_expired error when ?error=session_expired', async () => {
    const jsx = await Home({ searchParams: { error: 'session_expired' } })
    render(jsx as React.ReactElement)
    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i)
  })

  it('shows no error alert when no error param', async () => {
    const jsx = await Home({ searchParams: {} })
    render(jsx as React.ReactElement)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no error alert for unknown error values', async () => {
    const jsx = await Home({ searchParams: { error: 'unknown_error' } })
    render(jsx as React.ReactElement)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
