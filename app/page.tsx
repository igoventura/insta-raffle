import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginButton } from '@/components/login-button'

export default async function Home() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // If user is already logged in, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-indigo-50 to-white">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Insta-Raffle 🎉
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl">
          The easiest way to run giveaways on your Instagram account. Just log in, pick a post, and randomly select winners from comments with @mentions!
        </p>
        
        <div className="pt-8 border-t border-gray-200 w-full max-w-md flex flex-col items-center gap-4">
          <p className="text-sm text-gray-500 mb-2">Requires an Instagram Business or Creator account.</p>
          <LoginButton />
        </div>
      </div>
    </main>
  )
}
