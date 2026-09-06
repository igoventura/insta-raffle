import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  cookies().delete('fb_provider_token')
  return NextResponse.redirect(new URL('/', request.url), {
    status: 302,
  })
}
