import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoList } from '@/components/RepoList'
import type { Repo } from '@/lib/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

/**
 * Auto-incrementing counter used by makeRepo so every fixture gets a
 * unique, predictable numeric id. Reset to 1 in beforeEach for isolation.
 */
let idCounter = 1

/** Builds a Repo fixture, merging any overrides on top of sensible defaults. */
function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: idCounter++,
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

let repos: Repo[]

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  idCounter = 1
  repos = [
    makeRepo({ name: 'alpha', fork: false }),
    makeRepo({ name: 'beta', fork: true }),
    makeRepo({ name: 'gamma', fork: false }),
  ]
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
    render(<RepoList repos={[makeRepo({ name: 'a', fork: false })]} />)
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

  it('renders "just now" instead of "NaNy ago" when updatedAt is an invalid date string', () => {
    render(<RepoList repos={[makeRepo({ name: 'broken', updatedAt: 'invalid-date' })]} />)
    expect(screen.getByText('just now')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it('renders "Nmo ago" for timestamps between 30 and 364 days old', () => {
    // 40 days × 24h × 60m × 60s × 1000ms = 3,456,000,000 ms
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    render(<RepoList repos={[makeRepo({ name: 'month-old', updatedAt: fortyDaysAgo })]} />)
    // 40 days / 30 = 1.33 months → "1mo ago"
    expect(screen.getByText('1mo ago')).toBeInTheDocument()
  })

  it('renders "Ny ago" for timestamps older than 12 months', () => {
    // 400 days covers the years branch: floor(400/30)=13 months ≥ 12 → floor(13/12)=1 year
    const fourHundredDaysAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    render(<RepoList repos={[makeRepo({ name: 'year-old', updatedAt: fourHundredDaysAgo })]} />)
    expect(screen.getByText('1y ago')).toBeInTheDocument()
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

  describe('inner checkbox direct interaction', () => {
    it('clicking the inner checkbox input selects the repo via onChange without double-toggling', () => {
      render(<RepoList repos={repos} />)
      // Get the actual <input type="checkbox"> element (not the <li>)
      // The stopPropagation on its onClick prevents the parent <li> click from also firing,
      // so selection toggles exactly once (to selected), not twice (back to unselected).
      const innerCheckbox = screen.getByLabelText('Select alpha')
      fireEvent.click(innerCheckbox)
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('clicking the inner checkbox a second time deselects the repo', () => {
      render(<RepoList repos={repos} />)
      const innerCheckbox = screen.getByLabelText('Select alpha')
      fireEvent.click(innerCheckbox)
      expect(screen.getByText('1 selected')).toBeInTheDocument()
      fireEvent.click(innerCheckbox)
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    })
  })

  describe('keyboard interaction', () => {
    it('toggles selection via Space key on a focused row', () => {
      render(<RepoList repos={repos} />)
      // Reach the <li> row that wraps the "Select alpha" checkbox input
      const alphaRow = screen
        .getAllByRole('checkbox', { name: /select alpha/i })[0]
        .closest('li')!
      fireEvent.keyDown(alphaRow, { key: ' ' })
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('toggles selection via Enter key on a focused row', () => {
      render(<RepoList repos={repos} />)
      const alphaRow = screen
        .getAllByRole('checkbox', { name: /select alpha/i })[0]
        .closest('li')!
      fireEvent.keyDown(alphaRow, { key: 'Enter' })
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('deselects a previously-selected repo on a second Space keypress', () => {
      render(<RepoList repos={repos} />)
      const alphaRow = screen
        .getAllByRole('checkbox', { name: /select alpha/i })[0]
        .closest('li')!
      fireEvent.keyDown(alphaRow, { key: ' ' })
      expect(screen.getByText('1 selected')).toBeInTheDocument()
      fireEvent.keyDown(alphaRow, { key: ' ' })
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    })
  })

  describe('combined search and fork filter', () => {
    it('applies both filters simultaneously', async () => {
      render(<RepoList repos={repos} />)
      // Enable fork toggle so the fork repo (beta) becomes visible
      await userEvent.click(screen.getByLabelText(/show.*fork/i))
      expect(screen.getByText('beta')).toBeInTheDocument()
      // Type a search term that only matches the fork
      await userEvent.type(screen.getByRole('searchbox'), 'bet')
      expect(screen.getByText('beta')).toBeInTheDocument()
      expect(screen.queryByText('alpha')).not.toBeInTheDocument()
      expect(screen.queryByText('gamma')).not.toBeInTheDocument()
      // Disabling the fork toggle now leaves zero matches — both filters active
      await userEvent.click(screen.getByLabelText(/show.*fork/i))
      expect(screen.queryByText('beta')).not.toBeInTheDocument()
      expect(screen.getByText(/no repositories match/i)).toBeInTheDocument()
    })
  })

  describe('conditional row elements', () => {
    it('shows the fork badge when the fork toggle is on and the repo is a fork', async () => {
      render(<RepoList repos={repos} />)
      expect(screen.queryByText('fork')).not.toBeInTheDocument()
      await userEvent.click(screen.getByLabelText(/show.*fork/i))
      expect(screen.getByText('fork')).toBeInTheDocument()
    })

    it('does not show the fork badge for non-fork repos even when fork toggle is on', async () => {
      // Only one repo in the list — a non-fork
      render(<RepoList repos={[makeRepo({ name: 'plain', fork: false })]} />)
      // Fork toggle is absent (no forks exist), so badge can never appear
      expect(screen.queryByText('fork')).not.toBeInTheDocument()
    })

    it('shows star count when stargazerCount is greater than zero', () => {
      render(<RepoList repos={[makeRepo({ name: 'popular', stargazerCount: 42 })]} />)
      expect(screen.getByLabelText('42 stars')).toBeInTheDocument()
    })

    it('does not show a star element when stargazerCount is zero', () => {
      render(<RepoList repos={[makeRepo({ name: 'quiet', stargazerCount: 0 })]} />)
      expect(screen.queryByLabelText(/stars/i)).not.toBeInTheDocument()
    })
  })

  describe('select-all edge cases', () => {
    it('disables the select-all checkbox when no repos are visible', async () => {
      render(<RepoList repos={repos} />)
      // Search for something that matches nothing
      await userEvent.type(screen.getByRole('searchbox'), 'zzz')
      expect(screen.getByLabelText(/select all/i)).toBeDisabled()
    })
  })
})
