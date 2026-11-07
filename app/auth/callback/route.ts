import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  OAUTH_STATE_COOKIE_NAME,
  setSessionCookie,
} from '@/lib/auth/session'
import {
  exchangeInstagramCode,
  getInstagramProfile,
} from '@/lib/instagram/api'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, '')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME)

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${baseUrl}/?error=InvalidOAuthState`)
  }

  try {
    const tokenData = await exchangeInstagramCode(code)
    const profile = await getInstagramProfile(tokenData.accessToken)

    await setSessionCookie({
      accessToken: tokenData.accessToken,
      igUserId: profile.id || tokenData.userId,
      username: profile.username,
      name: profile.name,
      profilePictureUrl: profile.profile_picture_url,
      expiresAt: Date.now() + tokenData.expiresIn * 1000,
      isMock: false,
    })

    return NextResponse.redirect(`${baseUrl}${next}`)
  } catch {
    return NextResponse.redirect(`${baseUrl}/?error=AuthFailed`)
  }
}
