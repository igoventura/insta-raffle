import { NextResponse } from 'next/server'
import { getSession, verifyCommentSnapshot } from '@/lib/auth/session'
import { commitAtomicDraw } from '@/lib/firebase/admin'
import { qualifyComments, type GiveawayRules } from '@/lib/giveaway/logic'
import type { InstagramComment } from '@/lib/instagram/api'

interface DrawRequestPayload {
  mediaId: string
  postPermalink?: string
  postCaption?: string
  idempotencyKey: string
  rules: GiveawayRules
  comments: InstagramComment[]
  isSyncComplete: boolean
  syncToken: string
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  let body: DrawRequestPayload
  try {
    body = (await request.json()) as DrawRequestPayload
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    )
  }

  if (
    !body.mediaId ||
    !body.idempotencyKey ||
    !body.rules ||
    !Array.isArray(body.comments)
  ) {
    return NextResponse.json(
      { error: 'Missing required draw fields' },
      { status: 400 }
    )
  }

  if (!body.isSyncComplete) {
    return NextResponse.json(
      {
        error:
          'Comment synchronization is incomplete. Please resync all top-level comments before running an official draw.',
      },
      { status: 400 }
    )
  }

  const isSignatureValid = verifyCommentSnapshot(
    body.mediaId,
    body.isSyncComplete,
    body.comments,
    body.syncToken
  )

  if (!isSignatureValid) {
    return NextResponse.json(
      {
        error:
          'Invalid or expired comment snapshot signature. Please refresh the post page and try again.',
      },
      { status: 400 }
    )
  }

  const normalizedRules: GiveawayRules = {
    numWinners: Math.max(1, Math.min(100, Number(body.rules.numWinners) || 1)),
    numSubstitutes: Math.max(
      0,
      Math.min(100, Number(body.rules.numSubstitutes) || 0)
    ),
    maxEntriesPerUser: Math.max(
      1,
      Math.min(100, Number(body.rules.maxEntriesPerUser) || 1)
    ),
    hostUsername: session.username,
    deadlineIso: body.rules.deadlineIso || null,
    requiredKeyword: body.rules.requiredKeyword || null,
    blockedHandles: Array.isArray(body.rules.blockedHandles)
      ? body.rules.blockedHandles
      : [],
  }

  const qualification = qualifyComments(body.comments, normalizedRules)

  if (qualification.qualifiedEntries.length === 0) {
    return NextResponse.json(
      {
        error:
          'Zero qualified entries match the current rules. Adjust your filters before committing an official draw.',
      },
      { status: 400 }
    )
  }

  try {
    const snapshot = await commitAtomicDraw({
      mediaId: body.mediaId,
      postPermalink: body.postPermalink || '',
      postCaption: body.postCaption || '',
      ownerUsername: session.username,
      idempotencyKey: body.idempotencyKey,
      rules: normalizedRules,
      qualifiedEntries: qualification.qualifiedEntries,
      funnelCounts: qualification.funnelCounts,
    })

    return NextResponse.json(snapshot, { status: 200 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to execute atomic draw'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
