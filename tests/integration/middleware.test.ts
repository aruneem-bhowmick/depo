/**
 * @jest-environment node
 */

jest.mock('iron-session', () => ({
  getIronSession: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { middleware } from '@/middleware'

const mockGetIronSession = getIronSession as jest.Mock

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

describe('middleware', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('unauthenticated (no accessToken)', () => {
    beforeEach(() => {
      mockGetIronSession.mockResolvedValue({ accessToken: undefined })
    })

    it('redirects /repos to /', async () => {
      const response = await middleware(makeRequest('/repos'))
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/')
    })

    it('redirects /confirm to /', async () => {
      const response = await middleware(makeRequest('/confirm'))
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/')
    })

    it('redirects /done to /', async () => {
      const response = await middleware(makeRequest('/done'))
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/')
    })
  })

  describe('authenticated (has accessToken)', () => {
    beforeEach(() => {
      mockGetIronSession.mockResolvedValue({ accessToken: 'gho_abc' })
    })

    it('allows /repos through', async () => {
      const response = await middleware(makeRequest('/repos'))
      expect(response.status).not.toBe(307)
    })

    it('allows /confirm through', async () => {
      const response = await middleware(makeRequest('/confirm'))
      expect(response.status).not.toBe(307)
    })

    it('allows /done through', async () => {
      const response = await middleware(makeRequest('/done'))
      expect(response.status).not.toBe(307)
    })
  })

  describe('session retrieval error', () => {
    it('redirects to / when getIronSession throws', async () => {
      mockGetIronSession.mockRejectedValue(new Error('corrupted cookie'))
      const response = await middleware(makeRequest('/repos'))
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/')
    })
  })

  describe('public paths (no session check needed)', () => {
    it('passes / through without checking session', async () => {
      await middleware(makeRequest('/'))
      expect(mockGetIronSession).not.toHaveBeenCalled()
    })

    it('passes /api/auth/callback through', async () => {
      await middleware(makeRequest('/api/auth/callback'))
      expect(mockGetIronSession).not.toHaveBeenCalled()
    })

    it('does not protect false-prefix paths like /repos-test', async () => {
      await middleware(makeRequest('/repos-test'))
      expect(mockGetIronSession).not.toHaveBeenCalled()
    })

    it('does not protect false-prefix paths like /confirm-email', async () => {
      await middleware(makeRequest('/confirm-email'))
      expect(mockGetIronSession).not.toHaveBeenCalled()
    })
  })
})
