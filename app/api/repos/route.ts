import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { listPublicRepos } from '@/lib/github'

export async function GET() {
  const session = await getSession()

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const repos = await listPublicRepos(session.accessToken)
    return NextResponse.json(repos)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('401') || message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: `GitHub API error: ${message}` },
      { status: 500 },
    )
  }
}
