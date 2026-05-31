jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/github', () => ({ listPublicRepos: jest.fn() }))
jest.mock('@/components/RepoList', () => ({
  // jest.mock factories are extracted by babel-plugin-jest-hoist before
  // ts-jest's TypeScript pass, so they must be plain JS with no type
  // annotations — use React.createElement instead of JSX.
  // @ts-ignore — 'props' is intentionally untyped; annotations inside
  // jest.mock factories cause a Babel parse error at hoist extraction time.
  RepoList: (props) =>
    require('react').createElement(
      'div',
      { 'data-testid': 'repo-list' },
      props.repos.length + ' repos',
    ),
}))

import { render, screen } from '@testing-library/react'
import ReposPage from '@/app/repos/page'
import { getSession } from '@/lib/session'
import { listPublicRepos } from '@/lib/github'
import type { Repo } from '@/lib/types'

const mockGetSession = getSession as unknown as jest.Mock
const mockListPublicRepos = listPublicRepos as unknown as jest.Mock

const sampleRepo: Repo = {
  id: 1,
  name: 'test-repo',
  fullName: 'alice/test-repo',
  description: null,
  fork: false,
  stargazerCount: 0,
  updatedAt: '2024-01-01T00:00:00Z',
  url: 'https://github.com/alice/test-repo',
  visibility: 'public',
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGetSession.mockResolvedValue({ accessToken: 'gho_tok', login: 'alice' })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('/repos page', () => {
  it('renders the page heading', async () => {
    mockListPublicRepos.mockResolvedValue([sampleRepo])
    const jsx = await ReposPage()
    render(jsx as React.ReactElement)
    expect(screen.getByRole('heading', { name: /your repositories/i })).toBeInTheDocument()
  })

  it('passes fetched repos to RepoList', async () => {
    mockListPublicRepos.mockResolvedValue([sampleRepo, sampleRepo])
    const jsx = await ReposPage()
    render(jsx as React.ReactElement)
    expect(screen.getByTestId('repo-list')).toHaveTextContent('2 repos')
  })

  it('passes empty array to RepoList when user has no repos', async () => {
    mockListPublicRepos.mockResolvedValue([])
    const jsx = await ReposPage()
    render(jsx as React.ReactElement)
    expect(screen.getByTestId('repo-list')).toHaveTextContent('0 repos')
  })

  it('shows error alert when listPublicRepos throws', async () => {
    const err = new Error('GitHub API error: 503')
    mockListPublicRepos.mockRejectedValue(err)
    const jsx = await ReposPage()
    render(jsx as React.ReactElement)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('GitHub API error')
    expect(console.error).toHaveBeenCalledWith(
      '[ReposPage] listPublicRepos failed',
      { login: 'alice', error: err },
    )
  })

  it('shows Try again link on error', async () => {
    mockListPublicRepos.mockRejectedValue(new Error('fail'))
    const jsx = await ReposPage()
    render(jsx as React.ReactElement)
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/repos')
  })

  it('does not show RepoList on error', async () => {
    mockListPublicRepos.mockRejectedValue(new Error('fail'))
    const jsx = await ReposPage()
    render(jsx as React.ReactElement)
    expect(screen.queryByTestId('repo-list')).not.toBeInTheDocument()
  })
})
