import crypto from 'crypto'
import { cookies } from 'next/headers'
import type { InstagramComment } from '../instagram/api'

export const SESSION_COOKIE_NAME = 'insta_raffle_session'
export const OAUTH_STATE_COOKIE_NAME = 'insta_oauth_state'

export interface SessionPayload {
  accessToken: string
  igUserId: string
  username: string
  name: string
  profilePictureUrl: string
  expiresAt: number
  isMock?: boolean
}

function getDerivedKey(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.trim().length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production')
    }
    return crypto
      .createHash('sha256')
      .update('dev-fallback-insta-raffle-session-secret')
      .digest()
  }
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a SessionPayload using AES-256-GCM into base64url(iv).base64url(tag).base64url(ciphertext).
 */
export function encryptSession(payload: SessionPayload): string {
  const key = getDerivedKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`
}

/**
 * Decrypts and validates a SessionPayload token. Returns null if tampered or expired.
 */
export function decryptSession(token: string): SessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [ivB64, tagB64, dataB64] = parts
    const key = getDerivedKey()
    const iv = Buffer.from(ivB64, 'base64url')
    const authTag = Buffer.from(tagB64, 'base64url')
    const encrypted = Buffer.from(dataB64, 'base64url')

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    const payload = JSON.parse(decrypted.toString('utf8')) as SessionPayload

    if (!payload || typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!raw) return null
  return decryptSession(raw)
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const cookieStore = await cookies()
  const encrypted = encryptSession(payload)
  const maxAgeSeconds = Math.max(
    60,
    Math.floor((payload.expiresAt - Date.now()) / 1000)
  )
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

function serializeSnapshotForHmac(
  mediaId: string,
  isComplete: boolean,
  comments: InstagramComment[]
): string {
  const canonicalComments = comments.map((c) => ({
    id: c.id,
    username: c.username,
    text: c.text,
    timestamp: c.timestamp,
  }))
  return JSON.stringify({
    mediaId,
    isComplete,
    comments: canonicalComments,
  })
}

/**
 * Signs a synced top-level comment snapshot so POST /api/draws can verify it
 * in stateless memory without re-paginating the Instagram Graph API.
 */
export function signCommentSnapshot(
  mediaId: string,
  isComplete: boolean,
  comments: InstagramComment[]
): string {
  const key = getDerivedKey()
  const payload = serializeSnapshotForHmac(mediaId, isComplete, comments)
  return crypto.createHmac('sha256', key).update(payload, 'utf8').digest('hex')
}

export function verifyCommentSnapshot(
  mediaId: string,
  isComplete: boolean,
  comments: InstagramComment[],
  syncToken: string
): boolean {
  if (!syncToken || typeof syncToken !== 'string') return false
  const expectedHex = signCommentSnapshot(mediaId, isComplete, comments)
  const expectedBuf = Buffer.from(expectedHex, 'utf8')
  const actualBuf = Buffer.from(syncToken, 'utf8')
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}
