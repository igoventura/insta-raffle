import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=NoCodeProvided`)
  }

  const clientId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1612669340521588'
  const clientSecret = process.env.FACEBOOK_APP_SECRET
  const redirectUri = `${origin}/auth/callback`

  if (!clientSecret) {
    // If we don't have the secret configured, we can't exchange the code.
    // For development/mock purposes, we might just set a fake token to allow UI testing.
    cookies().set('fb_provider_token', 'MOCK_TOKEN', { httpOnly: true, path: '/' })
    return NextResponse.redirect(`${origin}/dashboard?warning=MissingAppSecret`)
  }

  try {
    const formData = new URLSearchParams()
    formData.append('client_id', clientId)
    formData.append('client_secret', clientSecret)
    formData.append('grant_type', 'authorization_code')
    formData.append('redirect_uri', redirectUri)
    formData.append('code', code)

    // Exchange code for access token using Instagram's endpoint
    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    if (data.access_token) {
      // For Instagram API with Instagram Login, we get a short-lived token.
      // Ideally we would exchange this for a long-lived token via Graph API,
      // but for this MVP we'll just use it immediately.
      cookies().set('fb_provider_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour for short-lived token
        path: '/'
      })
      return NextResponse.redirect(`${origin}/dashboard`)
    } else {
      console.error('Instagram Token Error:', data)
      return NextResponse.redirect(`${origin}/?error=TokenExchangeFailed`)
    }
  } catch (error) {
    console.error('OAuth Callback Error:', error)
    return NextResponse.redirect(`${origin}/?error=InternalServerError`)
  }
}
