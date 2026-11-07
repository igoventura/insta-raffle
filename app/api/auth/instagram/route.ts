import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  OAUTH_STATE_COOKIE_NAME,
  setSessionCookie,
} from '@/lib/auth/session'
import { getMockProfile, MOCK_ACCESS_TOKEN } from '@/lib/instagram/api'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const isMockRequested = searchParams.get('mock') === '1'
  const clientId = process.env.INSTAGRAM_CLIENT_ID

  if (isMockRequested || !clientId) {
    const mockProfile = getMockProfile()
    await setSessionCookie({
      accessToken: MOCK_ACCESS_TOKEN,
      igUserId: mockProfile.id,
      username: mockProfile.username,
      name: mockProfile.name,
      profilePictureUrl: mockProfile.profile_picture_url,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
      isMock: true,
    })
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI || `${origin}/auth/callback`
  const authorizeParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_manage_comments',
    state,
  })

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${authorizeParams.toString()}`
  )
}
