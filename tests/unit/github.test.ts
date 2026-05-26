import { createOctokit, listPublicRepos, deleteRepo } from '@/lib/github'

jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      paginate: jest.fn(),
      repos: {
        listForAuthenticatedUser: jest.fn(),
        delete: jest.fn(),
      },
    })),
  }
})

import { Octokit } from '@octokit/rest'

const mockOctokit = {
  paginate: jest.fn(),
  repos: {
    listForAuthenticatedUser: jest.fn(),
    delete: jest.fn().mockResolvedValue({}),
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(Octokit as jest.Mock).mockImplementation(() => mockOctokit)
})

describe('createOctokit()', () => {
  it('passes the token as auth option', () => {
    createOctokit('my-token')
    expect(Octokit).toHaveBeenCalledWith({ auth: 'my-token' })
  })
})

describe('listPublicRepos()', () => {
  const rawRepo = {
    id: 1,
    name: 'my-project',
    full_name: 'alice/my-project',
    description: 'A project',
    fork: false,
    stargazers_count: 3,
    updated_at: '2024-06-01T00:00:00Z',
    html_url: 'https://github.com/alice/my-project',
    visibility: 'public',
  }

  beforeEach(() => {
    mockOctokit.paginate.mockResolvedValue([rawRepo])
  })

  it('calls paginate with owner + public + sort:updated', async () => {
    await listPublicRepos('tok')
    expect(mockOctokit.paginate).toHaveBeenCalledWith(
      mockOctokit.repos.listForAuthenticatedUser,
      expect.objectContaining({ type: 'owner', visibility: 'public', sort: 'updated' }),
    )
  })

  it('maps raw GitHub fields to Repo interface', async () => {
    const repos = await listPublicRepos('tok')
    expect(repos[0]).toEqual({
      id: 1,
      name: 'my-project',
      fullName: 'alice/my-project',
      description: 'A project',
      fork: false,
      stargazerCount: 3,
      updatedAt: '2024-06-01T00:00:00Z',
      url: 'https://github.com/alice/my-project',
      visibility: 'public',
    })
  })

  it('falls back to null description when raw description is null', async () => {
    mockOctokit.paginate.mockResolvedValue([{ ...rawRepo, description: null }])
    const repos = await listPublicRepos('tok')
    expect(repos[0].description).toBeNull()
  })

  it('falls back to 0 stargazerCount when raw count is undefined', async () => {
    mockOctokit.paginate.mockResolvedValue([{ ...rawRepo, stargazers_count: undefined }])
    const repos = await listPublicRepos('tok')
    expect(repos[0].stargazerCount).toBe(0)
  })

  it('maps null updatedAt when raw updated_at is null', async () => {
    mockOctokit.paginate.mockResolvedValue([{ ...rawRepo, updated_at: null }])
    const repos = await listPublicRepos('tok')
    expect(repos[0].updatedAt).toBeNull()
  })

  it('passes visibility through directly without fabricating a default', async () => {
    mockOctokit.paginate.mockResolvedValue([{ ...rawRepo, visibility: 'private' }])
    const repos = await listPublicRepos('tok')
    expect(repos[0].visibility).toBe('private')
  })

  it('returns all pages (paginate handles this automatically)', async () => {
    const manyRepos = Array.from({ length: 250 }, (_, i) => ({ ...rawRepo, id: i, name: `repo-${i}`, full_name: `alice/repo-${i}` }))
    mockOctokit.paginate.mockResolvedValue(manyRepos)
    const repos = await listPublicRepos('tok')
    expect(repos).toHaveLength(250)
  })
})

describe('deleteRepo()', () => {
  it('calls octokit.repos.delete with owner and repo', async () => {
    await deleteRepo('tok', 'alice', 'my-project')
    expect(mockOctokit.repos.delete).toHaveBeenCalledWith({
      owner: 'alice',
      repo: 'my-project',
    })
  })

  it('propagates errors from octokit.repos.delete', async () => {
    mockOctokit.repos.delete.mockRejectedValueOnce(new Error('Not found'))
    await expect(deleteRepo('tok', 'alice', 'ghost-repo')).rejects.toThrow('Not found')
  })
})
