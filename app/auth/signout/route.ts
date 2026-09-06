import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  cookies().delete('fb_provider_token')
  return NextResponse.redirect(new URL('/', request.url), {
    status: 302,
  })
}
