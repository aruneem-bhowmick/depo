/**
 * @jest-environment node
 */

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

import { GET } from '@/app/api/me/route'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('GET /api/me', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ accessToken: undefined })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns { login } for authenticated session', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok', login: 'alice' })
    const res = await GET()
    const body = await res.json()
    expect(body.login).toBe('alice')
  })

  it('returns 200 status for authenticated session', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok', login: 'bob' })
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('returns error field in body for unauthenticated request', async () => {
    mockGetSession.mockResolvedValue({ accessToken: undefined })
    const res = await GET()
    const body = await res.json()
    expect(body.error).toBe('Not authenticated')
  })
})
