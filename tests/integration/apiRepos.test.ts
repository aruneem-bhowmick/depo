/**
 * @jest-environment node
 */

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/github', () => ({ listPublicRepos: jest.fn() }))

import { GET } from '@/app/api/repos/route'
import { getSession } from '@/lib/session'
import { listPublicRepos } from '@/lib/github'
import type { Repo } from '@/lib/types'

const mockGetSession = getSession as jest.Mock
const mockListPublicRepos = listPublicRepos as jest.Mock

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
})

describe('GET /api/repos', () => {
  it('returns 401 when no session accessToken', async () => {
    mockGetSession.mockResolvedValue({ accessToken: undefined })
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Not authenticated')
  })

  it('returns JSON array of repos when authenticated', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'gho_tok', login: 'alice' })
    mockListPublicRepos.mockResolvedValue([sampleRepo])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('test-repo')
  })

  it('passes accessToken to listPublicRepos', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'gho_abc', login: 'alice' })
    mockListPublicRepos.mockResolvedValue([])
    await GET()
    expect(mockListPublicRepos).toHaveBeenCalledWith('gho_abc')
  })

  it('returns 401 when GitHub returns 401 (revoked token)', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'gho_revoked' })
    mockListPublicRepos.mockRejectedValue(new Error('401 Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Session expired')
  })

  it('returns 500 for other GitHub errors', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'gho_tok' })
    mockListPublicRepos.mockRejectedValue(new Error('Service unavailable'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('GitHub API error')
  })

  it('returns empty array when user has no public repos', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'gho_tok' })
    mockListPublicRepos.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
