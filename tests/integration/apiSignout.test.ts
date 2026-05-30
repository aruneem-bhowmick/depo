/**
 * @jest-environment node
 */

/**
 * Integration tests for POST /api/signout.
 *
 * Drives the route handler directly — no HTTP server is started. The session
 * module is mocked at the module boundary so the real iron-session/next/headers
 * dependencies are never invoked. NEXT_PUBLIC_APP_URL is set in beforeEach and
 * cleaned up in afterEach to keep tests hermetic. The fallback test deletes the
 * variable mid-suite to exercise the try/catch path added to guard against a
 * missing or malformed env var.
 */

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

import { POST } from '@/app/api/signout/route'
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as jest.Mock

function makeRequest(url = 'http://localhost:3000/api/signout'): NextRequest {
  return new NextRequest(url, { method: 'POST' })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe('POST /api/signout', () => {
  it('calls session.destroy()', async () => {
    const mockDestroy = jest.fn()
    mockGetSession.mockResolvedValue({ destroy: mockDestroy })
    await POST(makeRequest())
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('redirects to NEXT_PUBLIC_APP_URL root', async () => {
    mockGetSession.mockResolvedValue({ destroy: jest.fn() })
    const res = await POST(makeRequest())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('works even when session is already empty (no-op destroy)', async () => {
    mockGetSession.mockResolvedValue({ destroy: jest.fn() })
    const res = await POST(makeRequest())
    expect(res.status).toBe(307)
  })

  it('falls back to request origin when NEXT_PUBLIC_APP_URL is absent', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    mockGetSession.mockResolvedValue({ destroy: jest.fn() })
    const res = await POST(makeRequest('http://localhost:3000/api/signout'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('falls back to request origin when NEXT_PUBLIC_APP_URL is not a valid URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'not-a-valid-url'
    mockGetSession.mockResolvedValue({ destroy: jest.fn() })
    const res = await POST(makeRequest('https://depo.vercel.app/api/signout'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://depo.vercel.app/')
  })
})
