import { getSession } from '@/lib/auth/session'
import { getInstagramPosts, InstagramPost } from '@/lib/instagram/api'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, Image as ImageIcon, MessageSquare } from 'lucide-react'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) {
    redirect('/')
  }

  let posts: InstagramPost[] = []
  let errorMsg = ''

  try {
    posts = await getInstagramPosts(session.accessToken, session.igUserId)
  } catch (err) {
    errorMsg =
      err instanceof Error
        ? err.message
        : 'Failed to fetch posts from Instagram.'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Select Post</h1>
        <p className="text-gray-500 mt-2">
          Choose a post from @{session.username} to configure rules and draw giveaway winners.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
        {posts.map(post => (
          <Link href={`/dashboard/post/${post.id}`} key={post.id}>
            <Card className="hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer h-full flex flex-col overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
                {post.media_url || post.thumbnail_url ? (
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
                <p className="text-sm text-gray-700 line-clamp-3 mb-3 flex-1">
                  {post.caption || 'No caption'}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
                  <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                  {typeof post.comments_count === 'number' && (
                    <span className="flex items-center gap-1 font-medium text-indigo-600">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {post.comments_count}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && !errorMsg && (
          <p className="text-gray-500 col-span-full">
            No posts found for @{session.username}.
          </p>
        )}
      </div>
    </div>
  )
}
