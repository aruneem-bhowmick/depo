/**
 * @jest-environment node
 */

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({ toString: () => 'deadbeef00112233deadbeef00112233' }),
}))

import { GET } from '@/app/api/auth/login/route'
import { NextRequest } from 'next/server'

const savedClientId = process.env.GITHUB_CLIENT_ID
const savedAppUrl = process.env.NEXT_PUBLIC_APP_URL

beforeEach(() => {
  jest.clearAllMocks()
  process.env.GITHUB_CLIENT_ID = 'test-client-id'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env.GITHUB_CLIENT_ID = savedClientId
  process.env.NEXT_PUBLIC_APP_URL = savedAppUrl
  jest.restoreAllMocks()
})

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login')
}

describe('GET /api/auth/login', () => {
  it('returns a 307 redirect to the GitHub OAuth authorize URL', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('github.com/login/oauth/authorize')
  })

  it('includes client_id in the redirect URL', async () => {
    const res = await GET(makeRequest())
    expect(res.headers.get('location')).toContain('client_id=test-client-id')
  })

  it('includes public_repo and delete_repo in the scope parameter', async () => {
    const res = await GET(makeRequest())
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('scope=public_repo')
    expect(location).toContain('delete_repo')
  })

  it('includes the CSRF state nonce in the redirect URL', async () => {
    const res = await GET(makeRequest())
    expect(res.headers.get('location')).toContain(
      'state=deadbeef00112233deadbeef00112233',
    )
  })

  it('includes redirect_uri pointing to /api/auth/callback', async () => {
    const res = await GET(makeRequest())
    const location = decodeURIComponent(res.headers.get('location') ?? '')
    expect(location).toContain('http://localhost:3000/api/auth/callback')
  })

  it('sets the depo_oauth_state cookie containing the CSRF nonce', async () => {
    const res = await GET(makeRequest())
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(
      'depo_oauth_state=deadbeef00112233deadbeef00112233',
    )
  })

  it('sets the depo_oauth_state cookie as httpOnly', async () => {
    const res = await GET(makeRequest())
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie.toLowerCase()).toContain('httponly')
  })

  it('sets the depo_oauth_state cookie with SameSite=Lax', async () => {
    const res = await GET(makeRequest())
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie.toLowerCase()).toContain('samesite=lax')
  })

  it('redirects to /?error=auth_failed when GITHUB_CLIENT_ID is missing', async () => {
    delete process.env.GITHUB_CLIENT_ID
    const res = await GET(makeRequest())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('redirects to /?error=auth_failed when NEXT_PUBLIC_APP_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const res = await GET(makeRequest())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })

  it('logs a console error naming the missing variable', async () => {
    delete process.env.GITHUB_CLIENT_ID
    await GET(makeRequest())
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('GITHUB_CLIENT_ID'),
    )
  })
})
