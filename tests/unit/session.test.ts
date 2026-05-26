jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({})),
}))

jest.mock('iron-session', () => ({
  getIronSession: jest.fn(async () => ({ accessToken: 'tok', login: 'alice', avatarUrl: '' })),
}))

import { getSession } from '@/lib/session'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/sessionOptions'

describe('getSession()', () => {
  it('calls getIronSession with cookies() and sessionOptions', async () => {
    await getSession()
    expect(getIronSession).toHaveBeenCalledWith(
      expect.anything(),
      sessionOptions,
    )
  })

  it('returns the session object from iron-session', async () => {
    const session = await getSession()
    expect(session.accessToken).toBe('tok')
    expect(session.login).toBe('alice')
  })
})
