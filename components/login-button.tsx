'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface LoginButtonProps {
  showDemoMode?: boolean
}

export function LoginButton({ showDemoMode = false }: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  const handleInstagramLogin = () => {
    setIsLoading(true)
    window.location.href = '/api/auth/instagram'
  }

  const handleDemoLogin = () => {
    setIsDemoLoading(true)
    window.location.href = '/api/auth/instagram?mock=1'
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
      <Button
        onClick={handleInstagramLogin}
        disabled={isLoading || isDemoLoading}
        size="lg"
        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {isLoading ? 'Connecting...' : 'Continue with Instagram'}
      </Button>

      {showDemoMode && (
        <Button
          onClick={handleDemoLogin}
          disabled={isLoading || isDemoLoading}
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
        >
          {isDemoLoading ? 'Loading Demo...' : 'Try Demo Mode (Mock Data)'}
        </Button>
      )}
    </div>
  )
}
