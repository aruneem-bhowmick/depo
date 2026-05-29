/**
 * @jest-environment node
 */

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/github', () => ({ deleteRepo: jest.fn() }))
jest.mock('@/lib/constants', () => ({
  DELETION_DELAY_MS: 0, // zero delay so the suite runs fast
  MAX_BATCH_SIZE: 100,
}))

import { POST } from '@/app/api/delete/route'
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { deleteRepo } from '@/lib/github'

const mockGetSession = getSession as jest.Mock
const mockDeleteRepo = deleteRepo as jest.Mock

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/delete', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const authedSession = { accessToken: 'gho_tok', login: 'alice' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue(authedSession)
  mockDeleteRepo.mockResolvedValue(undefined)
})

describe('POST /api/delete', () => {
  it('returns 401 when no session accessToken', async () => {
    mockGetSession.mockResolvedValue({ accessToken: undefined })
    const res = await POST(makeRequest({ repos: ['r'] }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/delete', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON body')
  })

  it('returns 400 when repos key is missing', async () => {
    const res = await POST(makeRequest({ notRepos: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('repos')
  })

  it('returns 400 when repos is empty array', async () => {
    const res = await POST(makeRequest({ repos: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('empty')
  })

  it('returns 400 when repos exceeds MAX_BATCH_SIZE', async () => {
    const repos = Array.from({ length: 101 }, (_, i) => `repo-${i}`)
    const res = await POST(makeRequest({ repos }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('100')
  })

  it('returns 400 when repos contains non-string entries', async () => {
    const res = await POST(makeRequest({ repos: [1, 2, 3] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('strings')
  })

  it('calls deleteRepo sequentially for each repo with the session login as owner', async () => {
    await POST(makeRequest({ repos: ['r1', 'r2', 'r3'] }))
    expect(mockDeleteRepo).toHaveBeenCalledTimes(3)
    expect(mockDeleteRepo).toHaveBeenNthCalledWith(1, 'gho_tok', 'alice', 'r1')
    expect(mockDeleteRepo).toHaveBeenNthCalledWith(2, 'gho_tok', 'alice', 'r2')
    expect(mockDeleteRepo).toHaveBeenNthCalledWith(3, 'gho_tok', 'alice', 'r3')
  })

  it('returns results array with status:deleted for each successful repo', async () => {
    const res = await POST(makeRequest({ repos: ['r1', 'r2'] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(2)
    expect(body.results[0]).toEqual({ repo: 'r1', status: 'deleted' })
    expect(body.results[1]).toEqual({ repo: 'r2', status: 'deleted' })
  })

  it('continues after a failed deletion and marks it as error', async () => {
    mockDeleteRepo
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('404 Not Found'))
      .mockResolvedValueOnce(undefined)

    const res = await POST(makeRequest({ repos: ['ok1', 'bad', 'ok2'] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe('deleted')
    expect(body.results[1].status).toBe('error')
    expect(body.results[1].error).toContain('not found')
    expect(body.results[2].status).toBe('deleted')
  })

  it('maps 403 error to delete_repo scope message', async () => {
    mockDeleteRepo.mockRejectedValueOnce(new Error('403 Forbidden'))
    const res = await POST(makeRequest({ repos: ['r'] }))
    const body = await res.json()
    expect(body.results[0].status).toBe('error')
    expect(body.results[0].error).toContain('delete_repo scope')
  })

  it('maps 404 error to repository-not-found message', async () => {
    mockDeleteRepo.mockRejectedValueOnce(new Error('404 Not Found'))
    const res = await POST(makeRequest({ repos: ['ghost'] }))
    const body = await res.json()
    expect(body.results[0].status).toBe('error')
    expect(body.results[0].error).toContain('not found')
  })

  it('maps 429 error to rate limit message', async () => {
    mockDeleteRepo.mockRejectedValueOnce(new Error('429 Too Many Requests'))
    const res = await POST(makeRequest({ repos: ['r'] }))
    const body = await res.json()
    expect(body.results[0].status).toBe('error')
    expect(body.results[0].error).toContain('rate limit')
  })

  it('does NOT use Promise.all — deleteRepo calls are strictly ordered', async () => {
    const callOrder: number[] = []
    mockDeleteRepo.mockImplementation(async (_token: string, _owner: string, repo: string) => {
      callOrder.push(parseInt(repo.split('-')[1]))
    })
    await POST(makeRequest({ repos: ['r-1', 'r-2', 'r-3'] }))
    expect(callOrder).toEqual([1, 2, 3])
  })
})
