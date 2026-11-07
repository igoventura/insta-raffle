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
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, '')
  const isMockRequested = searchParams.get('mock') === '1'
  const clientId = process.env.INSTAGRAM_CLIENT_ID
  const configId = process.env.INSTAGRAM_CONFIG_ID

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
    return NextResponse.redirect(`${baseUrl}/dashboard`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: baseUrl.startsWith('https://'),
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI || `${baseUrl}/auth/callback`

  if (configId) {
    const fbParams = new URLSearchParams({
      client_id: clientId,
      config_id: configId,
      override_default_response_type: 'true',
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })
    return NextResponse.redirect(
      `https://www.facebook.com/dialog/oauth?${fbParams.toString()}`
    )
  }

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
