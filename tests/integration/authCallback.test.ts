/**
 * @jest-environment node
 */

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}))
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

import { GET } from '@/app/api/auth/callback/route'
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'

const mockGetSession = getSession as jest.Mock
const mockCookies = cookies as jest.Mock

global.fetch = jest.fn()

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/auth/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

const mockSession = { accessToken: '', login: '', avatarUrl: '', save: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  process.env.GITHUB_CLIENT_ID = 'test-client-id'
  process.env.GITHUB_CLIENT_SECRET = 'test-client-secret'
  mockGetSession.mockResolvedValue(mockSession)
  mockCookies.mockReturnValue({
    get: jest.fn((name: string) =>
      name === 'depo_oauth_state' ? { value: 'valid-state' } : undefined
    ),
    delete: jest.fn(),
  })
})

afterEach(() => {
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
})

describe('GET /api/auth/callback', () => {
  it('redirects to /?error=auth_failed when state is missing', async () => {
    const res = await GET(makeRequest({ code: 'abc' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when state does not match cookie', async () => {
    const res = await GET(makeRequest({ code: 'abc', state: 'wrong-state' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when code is missing', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'valid-state' }) })
    const res = await GET(makeRequest({ state: 'valid-state' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when token exchange throws a network error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    const res = await GET(makeRequest({ code: 'good', state: 'valid-state' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when user profile fetch returns non-ok status', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'gho_tok' }) })
      .mockResolvedValueOnce({ ok: false })
    const res = await GET(makeRequest({ code: 'good', state: 'valid-state' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when token exchange returns error field', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ error: 'bad_verification_code' }),
    })
    const res = await GET(makeRequest({ code: 'bad', state: 'valid-state' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when token exchange returns no access_token', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({}),
    })
    const res = await GET(makeRequest({ code: 'bad', state: 'valid-state' }))
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('saves session and redirects to /repos on success', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'gho_tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          login: 'alice',
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
        }),
      })

    const res = await GET(makeRequest({ code: 'good', state: 'valid-state' }))

    expect(mockSession.save).toHaveBeenCalled()
    expect(mockSession.accessToken).toBe('gho_tok')
    expect(mockSession.login).toBe('alice')
    expect(mockSession.avatarUrl).toBe('https://avatars.githubusercontent.com/u/1')
    expect(res.headers.get('location')).toContain('/repos')
  })

  it('deletes the depo_oauth_state cookie on success', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'gho_tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'alice', avatar_url: '' }),
      })

    const res = await GET(makeRequest({ code: 'good', state: 'valid-state' }))
    expect(res.headers.get('location')).toContain('/repos')

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('depo_oauth_state=')
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  })
})
