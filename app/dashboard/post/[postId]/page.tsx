import { getSession, signCommentSnapshot } from '@/lib/auth/session'
import { getPostComments, getPostDetails } from '@/lib/instagram/api'
import { getPostDrawMetadata } from '@/lib/firebase/admin'
import { GiveawayEngine } from '@/components/giveaway-engine'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default async function GiveawayPostPage({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  const [postDetails, syncResult, postDrawMetadata] = await Promise.all([
    getPostDetails(postId, session.accessToken),
    getPostComments(postId, session.accessToken),
    getPostDrawMetadata(postId),
  ])

  const syncToken = signCommentSnapshot(
    postId,
    syncResult.isComplete,
    syncResult.comments
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run Giveaway</h1>
          <p className="text-gray-500 mt-1 line-clamp-1">
            {postDetails.caption || `Post ${postId}`}
          </p>
        </div>
      </div>

      <div className="pt-2">
        <GiveawayEngine
          mediaId={postId}
          postPermalink={postDetails.permalink}
          postCaption={postDetails.caption || ''}
          hostUsername={postDetails.username || session.username}
          comments={syncResult.comments}
          isSyncComplete={syncResult.isComplete}
          syncToken={syncToken}
          initialAttemptCount={postDrawMetadata.drawAttemptCount}
          initialPriorAttempts={postDrawMetadata.attempts}
        />
      </div>
    </div>
  )
}
