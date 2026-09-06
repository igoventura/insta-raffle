'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async () => {
    setIsLoading(true)
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'instagram',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights'
      }
    })

    if (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleLogin} disabled={isLoading} size="lg" className="w-full sm:w-auto bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 hover:opacity-90 text-white border-0">
      {isLoading ? 'Connecting...' : 'Continue with Instagram'}
    </Button>
  )
}
