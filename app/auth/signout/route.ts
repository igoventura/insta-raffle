import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'

export async function POST(request: Request) {
  const { origin } = new URL(request.url)
  await clearSessionCookie()
  return NextResponse.redirect(`${origin}/`, {
    status: 302,
  })
}
