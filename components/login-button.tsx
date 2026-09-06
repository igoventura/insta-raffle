'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = () => {
    setIsLoading(true)
    window.location.href = "https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1612669340521588&redirect_uri=https://lukaazvycpenbequfvaz.supabase.co/auth/v1/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights"
  }

  return (
    <Button onClick={handleLogin} disabled={isLoading} size="lg" className="w-full sm:w-auto bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 hover:opacity-90 text-white border-0">
      {isLoading ? 'Connecting...' : 'Continue with Instagram'}
    </Button>
  )
}
