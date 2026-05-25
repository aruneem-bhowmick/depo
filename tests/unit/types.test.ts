import type { Repo, DeletionResult, SessionData } from '@/lib/types'

describe('Repo interface', () => {
  it('accepts a valid repo object', () => {
    const repo: Repo = {
      id: 1,
      name: 'my-project',
      fullName: 'alice/my-project',
      description: 'A test project',
      fork: false,
      stargazerCount: 5,
      updatedAt: '2024-01-01T00:00:00Z',
      url: 'https://github.com/alice/my-project',
      visibility: 'public',
    }
    expect(repo.name).toBe('my-project')
    expect(repo.fullName).toBe('alice/my-project')
  })

  it('accepts null description', () => {
    const repo: Repo = {
      id: 2,
      name: 'nodesc',
      fullName: 'alice/nodesc',
      description: null,
      fork: false,
      stargazerCount: 0,
      updatedAt: '2024-01-01T00:00:00Z',
      url: 'https://github.com/alice/nodesc',
      visibility: 'public',
    }
    expect(repo.description).toBeNull()
  })
})

describe('DeletionResult interface', () => {
  it('accepts a successful deletion result', () => {
    const result: DeletionResult = { repo: 'my-project', status: 'deleted' }
    expect(result.status).toBe('deleted')
    expect(result.error).toBeUndefined()
  })

  it('accepts an error deletion result', () => {
    const result: DeletionResult = {
      repo: 'my-project',
      status: 'error',
      error: 'Not found',
    }
    expect(result.status).toBe('error')
    expect(result.error).toBe('Not found')
  })
})

describe('SessionData interface', () => {
  it('accepts valid session data', () => {
    const session: SessionData = {
      accessToken: 'gho_abc123',
      login: 'alice',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    }
    expect(session.login).toBe('alice')
  })
})
