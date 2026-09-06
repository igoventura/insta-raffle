import { cookies } from 'next/headers'
import { getInstagramAccounts } from '@/lib/instagram/api'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default async function DashboardPage() {
  const fbToken = cookies().get('fb_provider_token')?.value
  
  // MOCK DATA FALLBACK FOR DEVELOPMENT / DEMO
  let accounts: import('@/lib/instagram/api').InstagramAccount[] = []
  let errorMsg = ''

  if (!fbToken) {
    // We don't have the token, let's show mock data so the UI can be tested
    accounts = [
      { id: '12345', username: 'mock_business', name: 'Mock Business Account', profile_picture_url: '' },
      { id: '67890', username: 'mock_creator', name: 'Mock Creator Account', profile_picture_url: '' }
    ]
    errorMsg = "Development Mode: Showing mock accounts because no Facebook Access Token was found."
  } else {
    try {
      accounts = await getInstagramAccounts(fbToken)
    } catch {
      errorMsg = "Failed to fetch accounts from Instagram. Showing mock data."
      accounts = [
        { id: '12345', username: 'mock_business', name: 'Mock Business Account', profile_picture_url: '' }
      ]
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Select Account</h1>
        <p className="text-gray-500 mt-2">Choose an Instagram account to run the giveaway on.</p>
      </div>

      {errorMsg && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(account => (
          <Link href={`/dashboard/${account.id}`} key={account.id}>
            <Card className="hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {account.profile_picture_url ? (
                    <img src={account.profile_picture_url} alt={account.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-gray-400">📷</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{account.name}</h3>
                  <p className="text-gray-500">@{account.username}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {accounts.length === 0 && (
          <p className="text-gray-500 col-span-full">No Instagram Business accounts found linked to your Facebook pages.</p>
        )}
      </div>
    </div>
  )
}
