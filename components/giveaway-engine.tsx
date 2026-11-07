'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  History,
  MessageCircle,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react'
import type { InstagramComment } from '@/lib/instagram/api'
import {
  ALL_DISQUALIFICATION_REASONS,
  qualifyComments,
  type DisqualificationReason,
} from '@/lib/giveaway/logic'
import type { DrawAuditSnapshot } from '@/lib/firebase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface GiveawayEngineProps {
  mediaId: string
  postPermalink: string
  postCaption: string
  hostUsername: string
  comments: InstagramComment[]
  isSyncComplete: boolean
  syncToken: string
  initialAttemptCount: number
  initialPriorAttempts: Array<{
    drawId: string
    attemptNumber: number
    executedAt: string
  }>
}

const REASON_LABELS: Record<DisqualificationReason, string> = {
  PAST_DEADLINE: 'Posted after cutoff deadline',
  MISSING_KEYWORD: 'Missing required keyword/hashtag',
  NO_MENTION: 'No @mention found (0 mentions)',
  MULTIPLE_MENTIONS: 'Tagged 2 or more people (strictly 1 allowed)',
  SELF_MENTION: 'Commenter tagged themselves',
  HOST_MENTION: 'Commenter tagged post owner (@host)',
  BLOCKED_HANDLE: 'Commenter or tagged handle is on blocklist',
  DUPLICATE_TAGGED_FRIEND: 'Commenter already tagged this @friend earlier',
  EXCEEDED_USER_CAP: 'Exceeded per-user entry cap',
}

export function GiveawayEngine({
  mediaId,
  postPermalink,
  postCaption,
  hostUsername,
  comments,
  isSyncComplete,
  syncToken,
  initialAttemptCount,
  initialPriorAttempts,
}: GiveawayEngineProps) {
  const [numWinners, setNumWinners] = useState(3)
  const [numSubstitutes, setNumSubstitutes] = useState(2)
  const [maxEntriesPerUser, setMaxEntriesPerUser] = useState(3)
  const [deadlineLocal, setDeadlineLocal] = useState('')
  const [requiredKeyword, setRequiredKeyword] = useState('')
  const [blockedHandlesText, setBlockedHandlesText] = useState('')
  const [showAuditLog, setShowAuditLog] = useState(false)

  const [drawSnapshot, setDrawSnapshot] = useState<DrawAuditSnapshot | null>(
    null
  )
  const [attemptCount, setAttemptCount] = useState(initialAttemptCount)
  const [priorAttempts, setPriorAttempts] = useState(initialPriorAttempts)
  const [isDrawing, setIsDrawing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedVerifyUrl, setCopiedVerifyUrl] = useState(false)

  const blockedHandles = useMemo(() => {
    return blockedHandlesText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }, [blockedHandlesText])

  const deadlineIso = useMemo(() => {
    if (!deadlineLocal.trim()) return null
    const parsed = new Date(deadlineLocal)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }, [deadlineLocal])

  const qualification = useMemo(() => {
    return qualifyComments(comments, {
      numWinners,
      numSubstitutes,
      maxEntriesPerUser,
      hostUsername,
      deadlineIso,
      requiredKeyword: requiredKeyword.trim() || null,
      blockedHandles,
    })
  }, [
    comments,
    numWinners,
    numSubstitutes,
    maxEntriesPerUser,
    hostUsername,
    deadlineIso,
    requiredKeyword,
    blockedHandles,
  ])

  const handleRunOfficialDraw = async () => {
    setIsDrawing(true)
    setErrorMessage(null)
    setCopiedVerifyUrl(false)

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    try {
      const response = await fetch('/api/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          postPermalink,
          postCaption,
          idempotencyKey,
          rules: {
            numWinners,
            numSubstitutes,
            maxEntriesPerUser,
            hostUsername,
            deadlineIso,
            requiredKeyword: requiredKeyword.trim() || null,
            blockedHandles,
          },
          comments,
          isSyncComplete,
          syncToken,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to run official draw.')
        setIsDrawing(false)
        return
      }

      const snapshot = data as DrawAuditSnapshot
      setDrawSnapshot(snapshot)
      setAttemptCount(snapshot.attemptNumber)
      setPriorAttempts([
        ...snapshot.priorAttempts,
        {
          drawId: snapshot.drawId,
          attemptNumber: snapshot.attemptNumber,
          executedAt: snapshot.executedAt,
        },
      ])
      setIsDrawing(false)

      if (snapshot.winners.length > 0) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
        })
      }
    } catch {
      setErrorMessage('Network error while executing the official draw.')
      setIsDrawing(false)
    }
  }

  const handleCopyVerifyLink = (drawId: string) => {
    const url = `${window.location.origin}/verify/${drawId}`
    navigator.clipboard.writeText(url)
    setCopiedVerifyUrl(true)
    setTimeout(() => setCopiedVerifyUrl(false), 2500)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Rule Configuration */}
      <div className="lg:col-span-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <span>Raffle Qualification Rules</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numWinners">Winners (N)</Label>
                <Input
                  id="numWinners"
                  type="number"
                  min={1}
                  max={100}
                  value={numWinners}
                  onChange={(e) =>
                    setNumWinners(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numSubstitutes">Substitutes (S)</Label>
                <Input
                  id="numSubstitutes"
                  type="number"
                  min={0}
                  max={100}
                  value={numSubstitutes}
                  onChange={(e) =>
                    setNumSubstitutes(
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxEntriesPerUser">
                Entry Cap per User (Unique @friends)
              </Label>
              <Input
                id="maxEntriesPerUser"
                type="number"
                min={1}
                max={100}
                value={maxEntriesPerUser}
                onChange={(e) =>
                  setMaxEntriesPerUser(
                    Math.max(1, parseInt(e.target.value) || 1)
                  )
                }
              />
              <p className="text-xs text-gray-500">
                1 entry per comment with strictly 1 @mention. Duplicate tagged
                friends by the same user are ignored.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requiredKeyword">
                Required Keyword or Hashtag (Optional)
              </Label>
              <Input
                id="requiredKeyword"
                type="text"
                placeholder="e.g. #win"
                value={requiredKeyword}
                onChange={(e) => setRequiredKeyword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadlineLocal">
                Comment Cutoff Deadline (Optional)
              </Label>
              <Input
                id="deadlineLocal"
                type="datetime-local"
                value={deadlineLocal}
                onChange={(e) => setDeadlineLocal(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blockedHandles">
                Excluded @Usernames (Optional)
              </Label>
              <Input
                id="blockedHandles"
                type="text"
                placeholder="@sponsor1, @staff_member"
                value={blockedHandlesText}
                onChange={(e) => setBlockedHandlesText(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Self-tags and host tags (@{hostUsername}) are excluded
                automatically.
              </p>
            </div>

            {!isSyncComplete && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Comment sync was interrupted before reaching the final page.
                  Refresh to complete sync before drawing.
                </span>
              </div>
            )}

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-6 text-base"
              onClick={handleRunOfficialDraw}
              disabled={
                isDrawing ||
                !isSyncComplete ||
                qualification.qualifiedEntries.length === 0
              }
            >
              {isDrawing
                ? 'Committing Official Draw...'
                : `Run Official Draw #${attemptCount + 1}`}
            </Button>

            <p className="text-xs text-center text-gray-500">
              Running an official draw permanently increments this post&apos;s
              public attempt counter and creates a shareable audit record.
            </p>
          </CardContent>
        </Card>

        {priorAttempts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Draw History for This Post ({priorAttempts.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {priorAttempts.map((att) => (
                <div
                  key={att.drawId}
                  className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-800">
                    Attempt #{att.attemptNumber}
                  </span>
                  <span className="text-gray-400">
                    {new Date(att.executedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <Link
                    href={`/verify/${att.drawId}`}
                    target="_blank"
                    className="text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <span>Verify</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column: Live Dry-Run Qualification Preview & Official Draw Output */}
      <div className="lg:col-span-8 space-y-6">
        {/* Summary Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Top-Level Comments
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {qualification.funnelCounts.totalFetched}
                </p>
              </div>
              <MessageCircle className="w-8 h-8 text-gray-300" />
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium">
                  Qualified Entries (Tickets)
                </p>
                <p className="text-2xl font-bold text-green-900">
                  {qualification.funnelCounts.qualifiedEntries}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </CardContent>
          </Card>

          <Card className="bg-indigo-50 border-indigo-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-700 font-medium">
                  Unique Eligible People
                </p>
                <p className="text-2xl font-bold text-indigo-900">
                  {qualification.uniqueEligibleCommenters}
                </p>
              </div>
              <Users className="w-8 h-8 text-indigo-400" />
            </CardContent>
          </Card>
        </div>

        {/* Dry-Run Qualification Funnel Breakdown */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Dry-Run Qualification Preview
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Live breakdown of how current rules filter the synced comments
                before drawing.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLog((prev) => !prev)}
            >
              {showAuditLog ? 'Hide Comment Details' : 'Inspect Comments'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {ALL_DISQUALIFICATION_REASONS.map((reason) => {
                const count =
                  qualification.funnelCounts.rejectedByReason[reason]
                return (
                  <div
                    key={reason}
                    className={`flex items-center justify-between p-2 rounded border ${
                      count > 0
                        ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                        : 'bg-gray-50 border-gray-100 text-gray-500'
                    }`}
                  >
                    <span>{REASON_LABELS[reason]}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                )
              })}
            </div>

            {showAuditLog && (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto text-xs divide-y divide-gray-100">
                {qualification.qualifiedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 bg-green-50/30 flex items-center justify-between gap-3"
                  >
                    <div className="truncate">
                      <span className="font-semibold text-gray-900">
                        @{entry.username}
                      </span>{' '}
                      <span className="text-gray-600">{entry.text}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium whitespace-nowrap">
                      Ticket #{entry.userEntryNumber} (tagged @
                      {entry.mentionedHandle})
                    </span>
                  </div>
                ))}
                {qualification.disqualifiedComments.map((item) => (
                  <div
                    key={item.comment.id}
                    className="p-2.5 bg-white flex items-center justify-between gap-3"
                  >
                    <div className="truncate">
                      <span className="font-semibold text-gray-700">
                        @{item.comment.username}
                      </span>{' '}
                      <span className="text-gray-500">{item.comment.text}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 whitespace-nowrap">
                      Excluded: {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Official Draw Results Area */}
        {!isDrawing && !drawSnapshot && (
          <div className="h-56 flex flex-col items-center justify-center space-y-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
            <Trophy className="w-12 h-12 text-gray-300" />
            <p className="text-gray-600 font-medium">
              Review the Dry-Run Qualification Preview above, then click Run
              Official Draw to select {numWinners} winner(s) and{' '}
              {numSubstitutes} substitute(s).
            </p>
          </div>
        )}

        {drawSnapshot && (
          <div className="space-y-6">
            {/* Shareable Verification Banner */}
            <div className="bg-indigo-900 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-indigo-200">
                    Official Draw Attempt #{drawSnapshot.attemptNumber} Recorded
                  </span>
                </div>
                <p className="text-sm text-indigo-100">
                  Public verification page is live and locked with cryptographic
                  pool hash{' '}
                  <code className="bg-indigo-800 px-1.5 py-0.5 rounded text-xs">
                    {drawSnapshot.verification.poolHash.slice(0, 16)}...
                  </code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopyVerifyLink(drawSnapshot.drawId)}
                  className="flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedVerifyUrl ? 'Copied!' : 'Copy Verify Link'}</span>
                </Button>
                <Link
                  href={`/verify/${drawSnapshot.drawId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-md transition-colors"
                >
                  <span>Open Certificate</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Primary Winners Card */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-5 h-5 text-yellow-300" />
                  <h2 className="text-lg font-bold">
                    Official Winners ({drawSnapshot.winners.length})
                  </h2>
                </div>
                <span className="text-xs bg-indigo-700 px-2.5 py-1 rounded-full">
                  Attempt #{drawSnapshot.attemptNumber}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {drawSnapshot.winners.map((winner) => (
                  <div
                    key={winner.commentId}
                    className="p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base flex-shrink-0">
                      #{winner.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`https://instagram.com/${winner.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-base font-bold text-gray-900 hover:text-indigo-600 hover:underline"
                        >
                          @{winner.username}
                        </a>
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                          Tagged @{winner.mentionedHandle}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {winner.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ordered Substitutes Card */}
            {drawSnapshot.substitutes.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-800 p-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-5 h-5 text-sky-300" />
                    <h2 className="text-base font-bold">
                      Ordered Substitutes / Backups (
                      {drawSnapshot.substitutes.length})
                    </h2>
                  </div>
                  <span className="text-xs text-slate-300">
                    Promote in rank order if a winner does not respond
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {drawSnapshot.substitutes.map((sub) => (
                    <div
                      key={sub.commentId}
                      className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        S{sub.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={`https://instagram.com/${sub.username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-bold text-gray-900 hover:text-indigo-600 hover:underline"
                          >
                            @{sub.username}
                          </a>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            Tagged @{sub.mentionedHandle}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{sub.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
