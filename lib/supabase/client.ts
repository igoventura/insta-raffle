import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Note: We use NEXT_PUBLIC_SUPABASE_ANON_KEY for the publishable key in Supabase V2/SSR
  )
}
