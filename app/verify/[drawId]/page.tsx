import { getDrawAuditSnapshot } from '@/lib/firebase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  CheckCircle2,
  ExternalLink,
  History,
  Lock,
  ShieldCheck,
  Trophy,
  UserCheck,
} from 'lucide-react'

export default async function VerifyDrawPage({
  params,
}: {
  params: Promise<{ drawId: string }>
}) {
  const { drawId } = await params
  const snapshot = await getDrawAuditSnapshot(drawId)

  if (!snapshot) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-indigo-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm uppercase tracking-wider">
              <ShieldCheck className="w-5 h-5" />
              Public Giveaway Audit Certificate
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Official Draw Attempt #{snapshot.attemptNumber} for This Post
            </h1>
            <p className="text-sm text-gray-500">
              Host: <span className="font-medium text-gray-800">@{snapshot.ownerUsername}</span>{' '}
              · Executed at{' '}
              <span className="font-medium text-gray-800">
                {new Date(snapshot.executedAt).toLocaleString()}
              </span>
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <CheckCircle2 className="w-4 h-4" />
              Immutable Record ({snapshot.drawId})
            </span>
            {snapshot.postPermalink && (
              <a
                href={snapshot.postPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View Original Instagram Post
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Prior Attempts Banner (if Attempt > 1) */}
        {snapshot.priorAttempts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <History className="w-4 h-4 text-amber-700" />
                Prior Official Draw Attempts on This Post ({snapshot.priorAttempts.length})
              </div>
              <p className="text-xs text-amber-800">
                Every draw executed on a post increments the immutable attempt counter so hosts cannot silently re-roll results.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {snapshot.priorAttempts.map(attempt => (
                  <Link
                    key={attempt.drawId}
                    href={`/verify/${attempt.drawId}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    Attempt #{attempt.attemptNumber} ({new Date(attempt.executedAt).toLocaleDateString()})
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Winners & Substitutes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-indigo-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-950">
                <Trophy className="w-5 h-5 text-amber-500" />
                Official Winners ({snapshot.winners.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.winners.map(winner => (
                <div
                  key={winner.commentId}
                  className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      Winner #{winner.rank}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(winner.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="font-bold text-gray-900">
                    @{winner.username}
                  </div>
                  <div className="text-xs text-gray-600">
                    Valid 1-@mention tag:{' '}
                    <span className="font-medium text-indigo-700">
                      @{winner.mentionedHandle}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 italic bg-white p-2 rounded border border-gray-100 mt-1">
                    &ldquo;{winner.text}&rdquo;
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                Pre-Drawn Substitutes ({snapshot.substitutes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.substitutes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No alternates were requested for this draw.
                </p>
              ) : (
                snapshot.substitutes.map(sub => (
                  <div
                    key={sub.commentId}
                    className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Alternate #{sub.rank}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(sub.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="font-semibold text-gray-900">
                      @{sub.username}
                    </div>
                    <div className="text-xs text-gray-600">
                      Valid 1-@mention tag:{' '}
                      <span className="font-medium text-gray-800">
                        @{sub.mentionedHandle}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 italic bg-white p-2 rounded border border-gray-100 mt-1">
                      &ldquo;{sub.text}&rdquo;
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Frozen Qualification Rules & Funnel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Frozen Qualification Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-gray-700">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Mention Rule:</span>
                <span className="font-medium">Strictly 1 @mention per comment</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Pool Eligibility:</span>
                <span className="font-medium">Commenters only (no self/host tags)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Max Entries Per User:</span>
                <span className="font-medium">
                  {snapshot.rules.maxEntriesPerUser === 0
                    ? 'Unlimited (1 per unique friend)'
                    : snapshot.rules.maxEntriesPerUser}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Comment Cutoff Timestamp:</span>
                <span className="font-medium">
                  {snapshot.rules.deadlineIso
                    ? new Date(snapshot.rules.deadlineIso).toLocaleString()
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Required Keyword:</span>
                <span className="font-medium">
                  {snapshot.rules.requiredKeyword || 'None'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Excluded Handles:</span>
                <span className="font-medium">
                  {snapshot.rules.blockedHandles.length > 0
                    ? snapshot.rules.blockedHandles.map((h: string) => `@${h}`).join(', ')
                    : 'None'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Qualification Funnel Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-gray-700">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Total Fetched Top-Level Comments:</span>
                <span className="font-semibold">{snapshot.funnelCounts.totalFetched}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 text-green-700">
                <span>Total Valid Raffle Entries:</span>
                <span className="font-bold">{snapshot.funnelCounts.qualifiedEntries}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 text-indigo-700">
                <span>Unique Eligible Entrants:</span>
                <span className="font-bold">{snapshot.funnelCounts.uniqueEligibleCommenters}</span>
              </div>
              <div className="pt-1 text-xs text-gray-500 space-y-1">
                <div className="font-medium text-gray-700">Disqualified Breakdown:</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span>0 Mentions: {snapshot.funnelCounts.rejectedByReason.NO_MENTION}</span>
                  <span>2+ Mentions: {snapshot.funnelCounts.rejectedByReason.MULTIPLE_MENTIONS}</span>
                  <span>Self-Tag: {snapshot.funnelCounts.rejectedByReason.SELF_MENTION}</span>
                  <span>Host-Tag: {snapshot.funnelCounts.rejectedByReason.HOST_MENTION}</span>
                  <span>Duplicate Friend: {snapshot.funnelCounts.rejectedByReason.DUPLICATE_TAGGED_FRIEND}</span>
                  <span>Entry Cap: {snapshot.funnelCounts.rejectedByReason.EXCEEDED_USER_CAP}</span>
                  <span>Past Deadline: {snapshot.funnelCounts.rejectedByReason.PAST_DEADLINE}</span>
                  <span>Missing Keyword: {snapshot.funnelCounts.rejectedByReason.MISSING_KEYWORD}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cryptographic Verification Data */}
        <Card className="bg-slate-900 text-slate-100 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
              <Lock className="w-4 h-4 text-indigo-400" />
              Cryptographic Verification Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs font-mono">
            <div>
              <div className="text-slate-400 mb-1">Algorithm Version:</div>
              <div className="bg-slate-800 p-2 rounded text-indigo-300 break-all">
                {snapshot.verification.algorithmVersion}
              </div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">
                Canonical Entry Pool SHA-256 Hash (poolHash):
              </div>
              <div className="bg-slate-800 p-2 rounded text-emerald-300 break-all">
                {snapshot.verification.poolHash}
              </div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">
                256-bit CSPRNG Server Seed (serverSeed):
              </div>
              <div className="bg-slate-800 p-2 rounded text-amber-300 break-all">
                {snapshot.verification.serverSeed}
              </div>
            </div>
            <p className="text-slate-400 font-sans text-xs pt-1">
              Each entry index in the canonical valid entry list is scored via{' '}
              <code>HMAC-SHA256(serverSeed, poolHash + &quot;:&quot; + i)</code> and sorted ascending with automatic commenter deduplication so each person wins at most once.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
