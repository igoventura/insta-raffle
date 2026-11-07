import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  executeAtomicDraw,
  type DrawnParticipant,
  type FunnelCounts,
  type GiveawayRules,
  type QualifiedEntry,
} from '../giveaway/logic'

export interface AttemptSummary {
  drawId: string
  attemptNumber: number
  executedAt: string
  idempotencyKey: string
}

export interface PostDrawMetadata {
  mediaId: string
  ownerUsername: string
  drawAttemptCount: number
  lastDrawId: string
  lastDrawnAt: string
  attempts: AttemptSummary[]
}

export interface DrawAuditSnapshot {
  schemaVersion: 1
  drawId: string
  idempotencyKey: string
  mediaId: string
  postPermalink: string
  postCaption: string
  ownerUsername: string
  attemptNumber: number
  executedAt: string
  rules: {
    numWinners: number
    numSubstitutes: number
    maxEntriesPerUser: number
    deadlineIso: string | null
    requiredKeyword: string | null
    blockedHandles: string[]
  }
  funnelCounts: FunnelCounts
  verification: {
    algorithmVersion: 'hmac-sha256-fy-v1'
    poolHash: string
    serverSeed: string
  }
  winners: DrawnParticipant[]
  substitutes: DrawnParticipant[]
  priorAttempts: Array<{
    drawId: string
    attemptNumber: number
    executedAt: string
  }>
}

export interface CommitDrawInput {
  mediaId: string
  postPermalink: string
  postCaption: string
  ownerUsername: string
  idempotencyKey: string
  rules: GiveawayRules
  qualifiedEntries: QualifiedEntry[]
  funnelCounts: FunnelCounts
}

function getFirestoreInstance(): Firestore | null {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  let app: App
  const existing = getApps()
  if (existing.length > 0) {
    app = existing[0]
  } else {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }

  return getFirestore(app)
}

// ============================================================================
// Local tmpdir Fallback Store (used when FIREBASE_* env vars are not set in dev)
// Stored in os.tmpdir() so zero untracked files are created in the repo root.
// ============================================================================

interface LocalStoreData {
  posts: Record<string, PostDrawMetadata>
  draws: Record<string, DrawAuditSnapshot>
}

const LOCAL_STORE_PATH = path.join(
  os.tmpdir(),
  'insta-raffle-local-firestore.json'
)

function readLocalStore(): LocalStoreData {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf8')
      const parsed = JSON.parse(raw) as LocalStoreData
      return {
        posts: parsed.posts || {},
        draws: parsed.draws || {},
      }
    }
  } catch {
    // ignore corrupt tmp file
  }
  return { posts: {}, draws: {} }
}

function writeLocalStore(data: LocalStoreData): void {
  fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export async function getPostDrawMetadata(
  mediaId: string
): Promise<PostDrawMetadata> {
  const db = getFirestoreInstance()
  if (!db) {
    const store = readLocalStore()
    return (
      store.posts[mediaId] || {
        mediaId,
        ownerUsername: '',
        drawAttemptCount: 0,
        lastDrawId: '',
        lastDrawnAt: '',
        attempts: [],
      }
    )
  }

  const snap = await db.collection('posts').doc(mediaId).get()
  if (!snap.exists) {
    return {
      mediaId,
      ownerUsername: '',
      drawAttemptCount: 0,
      lastDrawId: '',
      lastDrawnAt: '',
      attempts: [],
    }
  }

  const data = snap.data() as Partial<PostDrawMetadata>
  return {
    mediaId,
    ownerUsername: data.ownerUsername || '',
    drawAttemptCount: data.drawAttemptCount || 0,
    lastDrawId: data.lastDrawId || '',
    lastDrawnAt: data.lastDrawnAt || '',
    attempts: Array.isArray(data.attempts) ? data.attempts : [],
  }
}

export async function getDrawAuditSnapshot(
  drawId: string
): Promise<DrawAuditSnapshot | null> {
  const db = getFirestoreInstance()
  if (!db) {
    const store = readLocalStore()
    return store.draws[drawId] || null
  }

  const snap = await db.collection('draws').doc(drawId).get()
  if (!snap.exists) return null
  return snap.data() as DrawAuditSnapshot
}

export async function commitAtomicDraw(
  input: CommitDrawInput
): Promise<DrawAuditSnapshot> {
  const db = getFirestoreInstance()
  const serverSeed = crypto.randomBytes(32).toString('hex')
  const executedAt = new Date().toISOString()

  if (!db) {
    const store = readLocalStore()
    const existingPost = store.posts[input.mediaId] || {
      mediaId: input.mediaId,
      ownerUsername: input.ownerUsername,
      drawAttemptCount: 0,
      lastDrawId: '',
      lastDrawnAt: '',
      attempts: [],
    }

    const matchingAttempt = existingPost.attempts.find(
      (a) => a.idempotencyKey === input.idempotencyKey
    )
    if (matchingAttempt && store.draws[matchingAttempt.drawId]) {
      return store.draws[matchingAttempt.drawId]
    }

    const nextAttempt = existingPost.drawAttemptCount + 1
    const drawId = crypto.randomUUID()

    const drawOutput = executeAtomicDraw(input.qualifiedEntries, input.rules, {
      serverSeed,
      postId: input.mediaId,
      attemptNumber: nextAttempt,
    })

    const priorAttempts = existingPost.attempts.map((a) => ({
      drawId: a.drawId,
      attemptNumber: a.attemptNumber,
      executedAt: a.executedAt,
    }))

    const snapshot: DrawAuditSnapshot = {
      schemaVersion: 1,
      drawId,
      idempotencyKey: input.idempotencyKey,
      mediaId: input.mediaId,
      postPermalink: input.postPermalink,
      postCaption: input.postCaption,
      ownerUsername: input.ownerUsername,
      attemptNumber: nextAttempt,
      executedAt,
      rules: {
        numWinners: input.rules.numWinners,
        numSubstitutes: input.rules.numSubstitutes,
        maxEntriesPerUser: input.rules.maxEntriesPerUser,
        deadlineIso: input.rules.deadlineIso || null,
        requiredKeyword: input.rules.requiredKeyword || null,
        blockedHandles: input.rules.blockedHandles || [],
      },
      funnelCounts: input.funnelCounts,
      verification: {
        algorithmVersion: drawOutput.algorithmVersion,
        poolHash: drawOutput.poolHash,
        serverSeed,
      },
      winners: drawOutput.winners,
      substitutes: drawOutput.substitutes,
      priorAttempts,
    }

    const updatedAttempts = [
      ...existingPost.attempts.slice(-99),
      {
        drawId,
        attemptNumber: nextAttempt,
        executedAt,
        idempotencyKey: input.idempotencyKey,
      },
    ]

    store.posts[input.mediaId] = {
      mediaId: input.mediaId,
      ownerUsername: input.ownerUsername,
      drawAttemptCount: nextAttempt,
      lastDrawId: drawId,
      lastDrawnAt: executedAt,
      attempts: updatedAttempts,
    }
    store.draws[drawId] = snapshot
    writeLocalStore(store)
    return snapshot
  }

  const postRef = db.collection('posts').doc(input.mediaId)

  return await db.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef)
    const postData: PostDrawMetadata = postSnap.exists
      ? (postSnap.data() as PostDrawMetadata)
      : {
          mediaId: input.mediaId,
          ownerUsername: input.ownerUsername,
          drawAttemptCount: 0,
          lastDrawId: '',
          lastDrawnAt: '',
          attempts: [],
        }

    const existingAttempts = Array.isArray(postData.attempts)
      ? postData.attempts
      : []
    const duplicate = existingAttempts.find(
      (a) => a.idempotencyKey === input.idempotencyKey
    )

    if (duplicate) {
      const existingDrawSnap = await tx.get(
        db.collection('draws').doc(duplicate.drawId)
      )
      if (existingDrawSnap.exists) {
        return existingDrawSnap.data() as DrawAuditSnapshot
      }
    }

    const nextAttempt = (postData.drawAttemptCount || 0) + 1
    const drawId = crypto.randomUUID()

    const drawOutput = executeAtomicDraw(input.qualifiedEntries, input.rules, {
      serverSeed,
      postId: input.mediaId,
      attemptNumber: nextAttempt,
    })

    const priorAttempts = existingAttempts.map((a) => ({
      drawId: a.drawId,
      attemptNumber: a.attemptNumber,
      executedAt: a.executedAt,
    }))

    const snapshot: DrawAuditSnapshot = {
      schemaVersion: 1,
      drawId,
      idempotencyKey: input.idempotencyKey,
      mediaId: input.mediaId,
      postPermalink: input.postPermalink,
      postCaption: input.postCaption,
      ownerUsername: input.ownerUsername,
      attemptNumber: nextAttempt,
      executedAt,
      rules: {
        numWinners: input.rules.numWinners,
        numSubstitutes: input.rules.numSubstitutes,
        maxEntriesPerUser: input.rules.maxEntriesPerUser,
        deadlineIso: input.rules.deadlineIso || null,
        requiredKeyword: input.rules.requiredKeyword || null,
        blockedHandles: input.rules.blockedHandles || [],
      },
      funnelCounts: input.funnelCounts,
      verification: {
        algorithmVersion: drawOutput.algorithmVersion,
        poolHash: drawOutput.poolHash,
        serverSeed,
      },
      winners: drawOutput.winners,
      substitutes: drawOutput.substitutes,
      priorAttempts,
    }

    const updatedAttempts = [
      ...existingAttempts.slice(-99),
      {
        drawId,
        attemptNumber: nextAttempt,
        executedAt,
        idempotencyKey: input.idempotencyKey,
      },
    ]

    const drawRef = db.collection('draws').doc(drawId)
    tx.set(drawRef, snapshot)
    tx.set(postRef, {
      mediaId: input.mediaId,
      ownerUsername: input.ownerUsername,
      drawAttemptCount: nextAttempt,
      lastDrawId: drawId,
      lastDrawnAt: executedAt,
      attempts: updatedAttempts,
    })

    return snapshot
  })
}
