import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoList } from '@/components/RepoList'
import type { Repo } from '@/lib/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

/** Builds a Repo fixture, merging any overrides on top of sensible defaults. */
function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: Math.random(),
    name: 'test-repo',
    fullName: 'alice/test-repo',
    description: 'A test repo',
    fork: false,
    stargazerCount: 0,
    updatedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    url: 'https://github.com/alice/test-repo',
    visibility: 'public',
    ...overrides,
  }
}

const repos: Repo[] = [
  makeRepo({ id: 1, name: 'alpha', fork: false }),
  makeRepo({ id: 2, name: 'beta', fork: true }),
  makeRepo({ id: 3, name: 'gamma', fork: false }),
]

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
})

describe('RepoList', () => {
  it('renders all non-fork repos by default (forks hidden)', () => {
    render(<RepoList repos={repos} />)
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.queryByText('beta')).not.toBeInTheDocument()
    expect(screen.getByText('gamma')).toBeInTheDocument()
  })

  it('shows the fork toggle when fork count > 0', () => {
    render(<RepoList repos={repos} />)
    expect(screen.getByLabelText(/show.*fork/i)).toBeInTheDocument()
  })

  it('does not show fork toggle when no forks exist', () => {
    render(<RepoList repos={[makeRepo({ id: 1, name: 'a', fork: false })]} />)
    expect(screen.queryByLabelText(/show.*fork/i)).not.toBeInTheDocument()
  })

  it('shows forks when fork toggle is checked', async () => {
    render(<RepoList repos={repos} />)
    await userEvent.click(screen.getByLabelText(/show.*fork/i))
    expect(screen.getByText('beta')).toBeInTheDocument()
  })

  it('filters repos by search input (case-insensitive)', async () => {
    render(<RepoList repos={repos} />)
    await userEvent.type(screen.getByRole('searchbox'), 'ALPHA')
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.queryByText('gamma')).not.toBeInTheDocument()
  })

  it('shows "no match" message when search yields no results', async () => {
    render(<RepoList repos={repos} />)
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText(/no repositories match/i)).toBeInTheDocument()
  })

  it('toggles repo selection on row click', async () => {
    render(<RepoList repos={repos} />)
    const row = screen.getAllByRole('checkbox', { name: /select alpha/i })[0]
    await userEvent.click(row.closest('li')!)
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
  })

  it('shows sticky footer only when at least one repo is selected', async () => {
    render(<RepoList repos={repos} />)
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('checkbox', { name: /select alpha/i })[0])
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('select all selects all visible repos', async () => {
    render(<RepoList repos={repos} />)
    await userEvent.click(screen.getByLabelText(/select all/i))
    // 2 non-fork repos visible (alpha + gamma)
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('select all deselects when all visible repos are already selected', async () => {
    render(<RepoList repos={repos} />)
    // Select all
    await userEvent.click(screen.getByLabelText(/select all/i))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    // Toggle again to deselect all
    await userEvent.click(screen.getByLabelText(/select all/i))
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
  })

  it('Continue → saves to sessionStorage and navigates to /confirm', async () => {
    render(<RepoList repos={repos} />)
    await userEvent.click(screen.getAllByRole('checkbox', { name: /select alpha/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    const stored = JSON.parse(sessionStorage.getItem('depo:selected') ?? '[]')
    expect(stored).toContain('alpha')
    expect(mockPush).toHaveBeenCalledWith('/confirm')
  })

  it('shows relative time on each repo row', () => {
    render(<RepoList repos={repos} />)
    expect(screen.getAllByText(/ago|just now/).length).toBeGreaterThan(0)
  })

  it('shows description when present', () => {
    render(<RepoList repos={[makeRepo({ description: 'My cool project' })]} />)
    expect(screen.getByText('My cool project')).toBeInTheDocument()
  })

  it('does not render a description element when description is null', () => {
    render(<RepoList repos={[makeRepo({ description: null })]} />)
    // Null description must not produce any visible text or "null" string
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })
})
