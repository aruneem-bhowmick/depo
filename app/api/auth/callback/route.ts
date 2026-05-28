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

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.error('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET')
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  let accessToken = ''
  try {
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
    accessToken = tokenData.access_token as string
  } catch (error) {
    console.error('Token exchange failed:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  let login = ''
  let avatarUrl = ''
  try {
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
    if (!userData.login || typeof userData.login !== 'string') {
      console.error('Invalid user data: missing or invalid login')
      return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
    }
    login = userData.login
    avatarUrl = (userData.avatar_url as string) || ''
  } catch (error) {
    console.error('User profile fetch failed:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  try {
    const session = await getSession()
    session.accessToken = accessToken
    session.login = login
    session.avatarUrl = avatarUrl
    await session.save()
  } catch (error) {
    console.error('Session save failed:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  const response = NextResponse.redirect(new URL('/repos', request.url))
  response.cookies.delete('depo_oauth_state')
  return response
}
