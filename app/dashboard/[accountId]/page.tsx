import { cookies } from 'next/headers'
import { getInstagramPosts } from '@/lib/instagram/api'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'

export default async function SelectPostPage({ params }: { params: { accountId: string } }) {
  const fbToken = cookies().get('fb_provider_token')?.value
  
  let posts: import('@/lib/instagram/api').InstagramPost[] = []
  
  if (!fbToken) {
    // Mock Data
    posts = [
      { id: 'post1', caption: 'Huge Giveaway! Tag 2 friends below to enter! 👇', media_type: 'IMAGE', media_url: '', thumbnail_url: '', permalink: '', timestamp: new Date().toISOString() },
      { id: 'post2', caption: 'New product launch 🎉 What do you think?', media_type: 'IMAGE', media_url: '', thumbnail_url: '', permalink: '', timestamp: new Date(Date.now() - 86400000).toISOString() },
    ]
  } else {
    try {
      posts = await getInstagramPosts(params.accountId, fbToken)
    } catch {
      posts = []
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Select Post</h1>
          <p className="text-gray-500 mt-2">Choose the post where the giveaway is happening.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
        {posts.map(post => (
          <Link href={`/dashboard/${params.accountId}/post/${post.id}`} key={post.id}>
            <Card className="hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer h-full flex flex-col overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
                {(post.media_url || post.thumbnail_url) ? (
                  <img 
                    src={post.thumbnail_url || post.media_url} 
                    alt="Post media" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <CardContent className="p-4 flex-1 flex flex-col">
                <p className="text-sm text-gray-700 line-clamp-3 mb-2 flex-1">
                  {post.caption || 'No caption'}
                </p>
                <p className="text-xs text-gray-400 mt-auto">
                  {new Date(post.timestamp).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-gray-500 col-span-full">No posts found for this account.</p>
        )}
      </div>
    </div>
  )
}
