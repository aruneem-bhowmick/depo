import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions } from './sessionOptions'
import type { SessionData } from './types'

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
