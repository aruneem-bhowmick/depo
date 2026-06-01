/**
 * Component tests for the /done summary page.
 *
 * Covers: sessionStorage-empty redirect, green/amber colour logic, singular/plural
 * count text, failed-repos section, sessionStorage cleanup, and the two action
 * buttons ("Delete more" → /repos, "Sign out" → POST /api/signout then /).
 */

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
}))

global.fetch = jest.fn().mockResolvedValue({ ok: true })

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DonePage from '@/app/done/page'
import type { DeletionResult } from '@/lib/types'

/** Writes a DeletionResult array to sessionStorage under the canonical key. */
function setResults(results: DeletionResult[]) {
  sessionStorage.setItem('depo:results', JSON.stringify(results))
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
})

describe('/done page', () => {
  it('redirects to / when sessionStorage is empty', async () => {
    render(<DonePage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('shows count in green when all deletions succeeded', async () => {
    setResults([
      { repo: 'r1', status: 'deleted' },
      { repo: 'r2', status: 'deleted' },
    ])
    render(<DonePage />)
    await waitFor(() => screen.getByText('2 repositories deleted'))
    expect(screen.getByText('2 repositories deleted').className).toContain('green')
  })

  it('shows count in amber when some deletions failed', async () => {
    setResults([
      { repo: 'r1', status: 'deleted' },
      { repo: 'r2', status: 'error', error: 'Not found' },
    ])
    render(<DonePage />)
    await waitFor(() => screen.getByText('1 repository deleted'))
    expect(screen.getByText('1 repository deleted').className).toContain('amber')
  })

  it('shows "1 repository deleted" (singular) when count is 1', async () => {
    setResults([{ repo: 'r1', status: 'deleted' }])
    render(<DonePage />)
    await waitFor(() => expect(screen.getByText('1 repository deleted')).toBeInTheDocument())
  })

  it('shows failed repos section when errors exist', async () => {
    setResults([{ repo: 'bad-repo', status: 'error', error: 'Forbidden' }])
    render(<DonePage />)
    await waitFor(() => screen.getByText('bad-repo'))
    expect(screen.getByText('Forbidden')).toBeInTheDocument()
  })

  it('does not show failed repos section when all succeed', async () => {
    setResults([{ repo: 'r1', status: 'deleted' }])
    render(<DonePage />)
    await waitFor(() => screen.getByText('1 repository deleted'))
    expect(screen.queryByText(/failed deletions/i)).not.toBeInTheDocument()
  })

  it('clears both sessionStorage keys after reading results', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['r1']))
    setResults([{ repo: 'r1', status: 'deleted' }])
    render(<DonePage />)
    await waitFor(() => screen.getByText('1 repository deleted'))
    expect(sessionStorage.getItem('depo:results')).toBeNull()
    expect(sessionStorage.getItem('depo:selected')).toBeNull()
  })

  it('"Delete more" button navigates to /repos', async () => {
    setResults([{ repo: 'r1', status: 'deleted' }])
    render(<DonePage />)
    await waitFor(() => screen.getByRole('button', { name: /delete more/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete more/i }))
    expect(mockPush).toHaveBeenCalledWith('/repos')
  })

  it('"Sign out" button calls POST /api/signout and navigates to /', async () => {
    setResults([{ repo: 'r1', status: 'deleted' }])
    render(<DonePage />)
    await waitFor(() => screen.getByRole('button', { name: /sign out/i }))
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/signout', { method: 'POST' })
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
