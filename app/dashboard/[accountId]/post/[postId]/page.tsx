import { cookies } from 'next/headers'
import { getPostComments } from '@/lib/instagram/api'
import { GiveawayEngine } from '@/components/giveaway-engine'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function GiveawayPage({ params }: { params: { accountId: string, postId: string } }) {
  const fbToken = cookies().get('fb_provider_token')?.value
  
  let comments: import('@/lib/instagram/api').InstagramComment[] = []
  
  if (!fbToken) {
    // MOCK DATA
    comments = [
      { id: '1', text: 'This is awesome! @friend1 @friend2', username: 'john_doe', timestamp: new Date().toISOString(), like_count: 0 },
      { id: '2', text: 'Love it! 💖 @bestie', username: 'jane_smith', timestamp: new Date().toISOString(), like_count: 0 },
      { id: '3', text: 'Nice giveaway!', username: 'no_tags_user', timestamp: new Date().toISOString(), like_count: 0 },
      { id: '4', text: 'Entering! @brother @sister', username: 'cool_kid99', timestamp: new Date().toISOString(), like_count: 0 },
      { id: '5', text: 'Pick me! @friend1', username: 'john_doe', timestamp: new Date().toISOString(), like_count: 0 },
      { id: '6', text: 'Another entry @anotherfriend', username: 'jane_smith', timestamp: new Date().toISOString(), like_count: 0 },
      { id: '7', text: 'Here we go @mom', username: 'winner_123', timestamp: new Date().toISOString(), like_count: 0 },
    ]
  } else {
    try {
      comments = await getPostComments(params.postId, fbToken)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/${params.accountId}`} className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run Giveaway</h1>
          <p className="text-gray-500 mt-2">Set your rules and draw a winner from the comments.</p>
        </div>
      </div>

      <div className="pt-4">
        <GiveawayEngine comments={comments} />
      </div>
    </div>
  )
}
