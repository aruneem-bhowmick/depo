import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = cookies()
  const storedState = cookieStore.get('depo_oauth_state')?.value

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  const tokenData = await tokenResponse.json()

  if (!tokenData.access_token || tokenData.error) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  const accessToken = tokenData.access_token as string

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!userResponse.ok) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  const userData = await userResponse.json()

  const session = await getSession()
  session.accessToken = accessToken
  session.login = userData.login as string
  session.avatarUrl = userData.avatar_url as string
  await session.save()

  const response = NextResponse.redirect(new URL('/repos', request.url))
  response.cookies.delete('depo_oauth_state')
  return response
}
