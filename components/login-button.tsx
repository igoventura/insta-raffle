'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = () => {
    setIsLoading(true)
    const clientId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1612669340521588'
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`)
    const scopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights'
    
    window.location.href = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`
  }

  return (
    <Button onClick={handleLogin} disabled={isLoading} size="lg" className="w-full sm:w-auto bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 hover:opacity-90 text-white border-0">
      {isLoading ? 'Connecting...' : 'Continue with Instagram'}
    </Button>
  )
}
